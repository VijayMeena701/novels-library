"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { CAPABILITY } from "../../utils/permissions";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Spinner } from "../../components/ui/spinner";
import {
  LayoutDashboard,
  Users,
  Shield,
  Key,
  Folder,
  ScrollText,
  FileText,
  Settings,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  guard?: string;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/roles", label: "Roles", icon: Shield },
  { href: "/admin/groups", label: "Permission Groups", icon: Key },
  { href: "/admin/resources", label: "Resources", icon: Folder },
  { href: "/admin/app-config", label: "App Config", icon: Settings, guard: CAPABILITY.APP_CONFIG_READ },
  { href: "/admin/logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/reports", label: "Reports", icon: FileText, guard: CAPABILITY.BOOKS_MANAGE },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, hasCapability } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !hasCapability(CAPABILITY.ADMIN_ACCESS)) {
      router.push("/profile");
    }
  }, [loading, hasCapability, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasCapability(CAPABILITY.ADMIN_ACCESS)) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <span className="font-semibold text-foreground">Admin Console</span>
        <Button variant="secondary" size="icon" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 transform border-r border-border bg-card transition-transform duration-200 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b border-border px-4 font-bold text-foreground">
          Admin Console
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const disabled = item.guard ? !hasCapability(item.guard) : false;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-copy hover:bg-surface-muted hover:text-foreground",
                  disabled && "pointer-events-none opacity-50"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-foreground/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="flex-1 p-4 pt-16 md:p-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}
