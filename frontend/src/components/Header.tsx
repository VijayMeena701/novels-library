"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, User, Settings, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { CAPABILITY } from "../utils/permissions";

const publicLinks = [
	{ href: "/", label: "Home", match: (pathname: string) => pathname === "/" },
	{ href: "/novels", label: "Novels", match: (pathname: string) => pathname.startsWith("/novels") },
	{ href: "/authors", label: "Authors", match: (pathname: string) => pathname.startsWith("/authors") },
];

const adminLinks = [{ href: "/scraper", label: "Scrapers", match: (pathname: string) => pathname === "/scraper" }];

export default function Header() {
	const pathname = usePathname();
	const { user, logout, hasCapability } = useAuth();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);

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

	if (pathname === "/login") return null;

	const links = user ? [...publicLinks, ...(hasCapability(CAPABILITY.JOB_READ) ? adminLinks : [])] : publicLinks;

	const navLinkClass = (active: boolean) =>
		cn(
			"rounded-md px-3 py-2 text-[0.86rem] font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground",
			active && "bg-primary-soft text-foreground shadow-[inset_0_-2px_0_var(--secondary)]",
		);

	return (
		<header className="sticky top-0 z-[100] border-b border-border bg-[rgba(255,253,248,0.88)] shadow-[0_2px_18px_rgba(48,39,28,0.04)] backdrop-blur-[18px]">
			<div className="mx-auto flex min-h-[62px] w-full max-w-[1520px] items-center justify-between gap-4 px-5 py-2.5">
				<Link href="/" className="inline-flex min-w-0 items-center gap-2.5 text-inherit no-underline">
					<span className="inline-flex size-[34px] items-center justify-center rounded-md bg-gradient-to-br from-primary to-[#263a5c] font-black text-white shadow-[0_9px_20px_rgba(64,95,143,0.22)]">
						N
					</span>
					<span className="whitespace-nowrap text-base font-black text-foreground">Novels Library</span>
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
					) : (
						<Button asChild size="sm">
							<Link href="/login">Login</Link>
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
								href="/login"
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
