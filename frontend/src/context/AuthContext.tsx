"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Ability } from "@casl/ability";
import { api, ApiError, User } from "../utils/api";
import { CAPABILITY } from "../utils/permissions";
import { buildAbilityFor } from "../utils/ability";

interface AuthContextType {
	user: User | null;
	ability: Ability | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (username: string, email: string, password: string) => Promise<void>;
	updateUser: (payload: { username?: string; avatarUrl?: string }) => Promise<void>;
	logout: () => void;
	hasCapability: (capability: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isProtectedRoute(pathname: string): boolean {
	return pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname.startsWith("/scraper") || pathname.startsWith("/admin");
}

function parseJwtPayload(token: string) {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const decoded = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="));
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [ability, setAbility] = useState<Ability | null>(null);
	const [loading, setLoading] = useState(true);
	const router = useRouter();
	const pathname = usePathname();

	const setUserAndAbility = useCallback((nextUser: User | null) => {
		setUser(nextUser);
		setAbility(nextUser ? buildAbilityFor(nextUser.capabilities || [], nextUser.isSuperuser) : buildAbilityFor([]));
	}, []);

	const hasCapability = useCallback(
		(capability: string) => {
			if (!ability) return false;
			const [subject, action] = capability.split(":");
			if (!subject || !action) return false;
			return ability.can(action, subject);
		},
		[ability]
	);

	useEffect(() => {
		async function checkAuth() {
			if (api.isLoggedIn()) {
				const token = localStorage.getItem("novel_lib_token");
				if (token) {
					const decoded = parseJwtPayload(token) as { id?: string; email?: string } | null;
					if (decoded?.id) {
						setUser({ id: decoded.id, email: decoded.email || "", username: "" } as User);
					}
				}

				try {
					const data = await api.getMe();
					setUserAndAbility(data.user);
				} catch (err) {
					console.error("Failed to authenticate stored token:", err);
					if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
						api.logout();
						setUserAndAbility(null);
					}
				}
			} else {
				setUserAndAbility(null);
			}
			setLoading(false);
		}
		checkAuth();
	}, [setUserAndAbility]);

	useEffect(() => {
		if (!loading) {
			const isAuthPage = pathname === "/login";
			if (!user && !isAuthPage && isProtectedRoute(pathname)) {
				router.push("/login");
			} else if (user && isAuthPage) {
				router.push("/profile");
			} else if (user && pathname.startsWith("/scraper") && !hasCapability(CAPABILITY.JOBS_LIST)) {
				router.push("/profile");
			} else if (user && pathname.startsWith("/admin") && !hasCapability(CAPABILITY.ADMIN_ACCESS)) {
				router.push("/profile");
			}
		}
	}, [user, loading, pathname, router, hasCapability]);

	const login = useCallback(async (email: string, password: string) => {
		setLoading(true);
		try {
			const data = await api.login(email, password);
			setUserAndAbility(data.user);
			setLoading(false);
			router.push("/profile");
		} catch (err) {
			setLoading(false);
			throw err;
		}
	}, [setUserAndAbility, router]);

	const register = useCallback(async (username: string, email: string, password: string) => {
		setLoading(true);
		try {
			const data = await api.register(username, email, password);
			setUserAndAbility(data.user);
			setLoading(false);
			router.push("/profile");
		} catch (err) {
			setLoading(false);
			throw err;
		}
	}, [setUserAndAbility, router]);

	const updateUser = useCallback(async (payload: { username?: string; avatarUrl?: string }) => {
		const data = await api.updateMe(payload);
		setUserAndAbility(data.user);
	}, [setUserAndAbility]);

	const logout = useCallback(() => {
		api.logout();
		setUserAndAbility(null);
		router.push("/login");
	}, [setUserAndAbility, router]);

	const value = useMemo(
		() => ({ user, ability, loading, login, register, updateUser, logout, hasCapability }),
		[user, ability, loading, login, logout, register, updateUser, hasCapability]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
