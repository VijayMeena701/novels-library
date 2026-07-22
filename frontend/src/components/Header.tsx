"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, User, Settings, LogOut, Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useReaderTheme } from "../context/ReaderThemeContext";
import { applyReaderThemeCssVariables } from "../lib/reader-theme";
import { cn, getLoginHref } from "../lib/utils";
import { Button } from "./ui/button";
import { CAPABILITY } from "../utils/permissions";
import { api } from "../utils/api";

const publicLinks = [
	{ href: "/", label: "Home", match: (pathname: string) => pathname === "/" },
	{ href: "/books", label: "Books", match: (pathname: string) => pathname.startsWith("/books") },
	{ href: "/authors", label: "Authors", match: (pathname: string) => pathname.startsWith("/authors") },
	{ href: "/requests", label: "Requests", match: (pathname: string) => pathname.startsWith("/requests") },
];

const adminLinks = [{ href: "/scraper", label: "Scrapers", match: (pathname: string) => pathname === "/scraper" }];
const consoleLinks = [{ href: "/admin", label: "Admin", match: (pathname: string) => pathname.startsWith("/admin") }];

export default function Header() {
	const pathname = usePathname();
	const { user, logout, hasCapability } = useAuth();
	const { theme: readerTheme } = useReaderTheme();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const userMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		async function loadUnreadCount() {
			try {
				const data = await api.getNotifications(true);
				if (!cancelled) setUnreadCount(data.unreadCount);
			} catch {
				// ignore
			}
		}
		void loadUnreadCount();
		const interval = setInterval(loadUnreadCount, 60000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [user]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
				setIsUserMenuOpen(false);
			}
		}

		if (isUserMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isUserMenuOpen]);

	if (pathname === "/login" || /^\/books\/[^/]+\/reader(?:\/|$)/.test(pathname)) return null;

	const links = user
		? [
				...publicLinks,
				...(hasCapability(CAPABILITY.JOBS_LIST) ? adminLinks : []),
				...(hasCapability(CAPABILITY.ADMIN_ACCESS) ? consoleLinks : []),
		  ]
		: publicLinks;

	const isThemed = readerTheme !== null;
	const readerThemeStyle = isThemed ? applyReaderThemeCssVariables(readerTheme) : undefined;

	const navLinkClass = (active: boolean) =>
		cn(
			"rounded-md px-3 py-2 text-[0.85rem] font-semibold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
			active && "bg-primary-soft text-foreground",
		);

	return (
		<header
			className={cn(
				"sticky top-0 z-[100] border-b backdrop-blur-[18px]",
				isThemed
					? "reader-theme border-b border-transparent bg-[color-mix(in_srgb,var(--reader-bg)_80%,transparent)]"
					: "border-border bg-background/80",
			)}
			style={readerThemeStyle}
		>
			<div className="mx-auto flex min-h-[58px] w-full max-w-[1520px] items-center justify-between gap-4 px-5 py-2">
				<Link href="/" className="inline-flex min-w-0 items-center gap-2.5 text-inherit no-underline">
					<span className="inline-flex size-[32px] items-center justify-center rounded-md bg-primary font-black text-white">
						N
					</span>
					<span className="whitespace-nowrap text-base font-bold text-foreground">Books Library</span>
				</Link>

				<div className="hidden items-center gap-1 md:flex">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={navLinkClass(link.match(pathname))}
						>
							{link.label}
						</Link>
					))}

					{user && <div className="mx-1.5 h-5 w-px bg-border" />}

					{user ? (
						<>
							<Link href="/notifications" className="relative inline-flex items-center justify-center rounded-md px-2 py-2 text-copy transition hover:bg-primary-soft hover:text-foreground">
								<Bell className="size-5" />
								{unreadCount > 0 && (
									<span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
										{unreadCount > 99 ? '99+' : unreadCount}
									</span>
								)}
							</Link>
							<div className="relative" ref={userMenuRef}>
								<Button
									variant="ghost"
									size="sm"
									className="inline-flex items-center gap-2"
									aria-expanded={isUserMenuOpen}
									aria-label="User menu"
									onClick={() => setIsUserMenuOpen((open) => !open)}
								>
									<User className="size-4" />
									<span className="max-w-[120px] truncate">{user.username}</span>
								</Button>

							{isUserMenuOpen && (
								<div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-card p-1 shadow-card">
									<Link
										href="/profile"
										onClick={() => setIsUserMenuOpen(false)}
										className={cn(
											"flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
											pathname.startsWith("/profile") && "bg-primary-soft text-foreground",
										)}
									>
										<User className="size-4" />
										Profile
									</Link>
									<Link
										href="/settings"
										onClick={() => setIsUserMenuOpen(false)}
										className={cn(
											"flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
											pathname.startsWith("/settings") && "bg-primary-soft text-foreground",
										)}
									>
										<Settings className="size-4" />
										Settings
									</Link>
									<button
										type="button"
										onClick={() => {
											setIsUserMenuOpen(false);
											logout();
										}}
										className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-copy transition hover:bg-red-50 hover:text-red-700"
									>
										<LogOut className="size-4" />
										Logout
									</button>
								</div>
							)}
						</div>
					</>
				) : (
						<Button asChild size="sm">
							<Link href={getLoginHref(pathname)}>Login</Link>
						</Button>
					)}
				</div>

				<Button
					variant="ghost"
					size="icon"
					className="md:hidden"
					aria-expanded={isMobileMenuOpen}
					aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
					onClick={() => setIsMobileMenuOpen((open) => !open)}
				>
					{isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
				</Button>
			</div>

			{isMobileMenuOpen && (
				<div className="absolute left-0 right-0 top-full border-b border-border bg-card p-4 shadow-card md:hidden">
					<nav className="flex flex-col gap-1">
						{links.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={() => setIsMobileMenuOpen(false)}
								className={cn(
									"rounded-md px-3 py-2.5 text-sm font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
									link.match(pathname) && "bg-primary-soft text-foreground",
								)}
							>
								{link.label}
							</Link>
						))}

						{user && (
							<>
								<div className="my-2 h-px bg-border" />
								<div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-copy">
									<User className="size-4" />
									<span className="truncate">{user.username}</span>
								</div>
								<Link
									href="/profile"
									onClick={() => setIsMobileMenuOpen(false)}
									className={cn(
										"flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
										pathname.startsWith("/profile") && "bg-primary-soft text-foreground",
									)}
								>
									<User className="size-4" />
									Profile
								</Link>
								<Link
									href="/settings"
									onClick={() => setIsMobileMenuOpen(false)}
									className={cn(
										"flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
										pathname.startsWith("/settings") && "bg-primary-soft text-foreground",
									)}
								>
									<Settings className="size-4" />
									Settings
								</Link>
								<button
									type="button"
									onClick={() => {
										setIsMobileMenuOpen(false);
										logout();
									}}
									className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-bold text-copy transition hover:bg-red-50 hover:text-red-700"
								>
									<LogOut className="size-4" />
									Logout
								</button>
							</>
						)}

						{!user && (
							<Link
								href={getLoginHref(pathname)}
								onClick={() => setIsMobileMenuOpen(false)}
								className="rounded-md bg-primary px-3 py-2.5 text-center text-sm font-bold text-white no-underline transition hover:bg-primary-hover"
							>
								Login
							</Link>
						)}
					</nav>
				</div>
			)}
		</header>
	);
}
