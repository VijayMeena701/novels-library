'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, User, Settings, LogOut, Bell, Palette, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReaderTheme } from '../context/ReaderThemeContext';
import { APP_THEMES, themes, type AppTheme } from '../design-system/themes';
import { cn, getLoginHref } from '../lib/utils';
import { Button } from './ui/button';
import { navItemVariants, navItemActiveVariants } from '../design-system/components/navigation';
import { CAPABILITY } from '../utils/permissions';
import { api } from '../utils/api';

const publicLinks = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  { href: '/books', label: 'Books', match: (pathname: string) => pathname.startsWith('/books') },
  { href: '/authors', label: 'Authors', match: (pathname: string) => pathname.startsWith('/authors') },
  { href: '/requests', label: 'Requests', match: (pathname: string) => pathname.startsWith('/requests') },
];

const adminLinks = [{ href: '/scraper', label: 'Scrapers', match: (pathname: string) => pathname === '/scraper' }];
const consoleLinks = [{ href: '/admin', label: 'Admin', match: (pathname: string) => pathname.startsWith('/admin') }];

interface ThemePickerProps {
  theme: AppTheme;
  onChange: (theme: AppTheme) => void;
}

function ThemePicker({ theme, onChange }: ThemePickerProps) {
  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
        <Palette className="size-3.5" /> Theme
      </div>
      <div className="grid grid-cols-5 gap-2">
        {APP_THEMES.map((t) => {
          const isActive = theme === t;
          const accent = themes[t]['reader.accent'];
          return (
            <button
              key={t}
              type="button"
              title={t}
              onClick={() => onChange(t)}
              className={cn(
                'size-8 rounded-full border-2 transition duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive ? 'bg-surface' : 'border-transparent',
              )}
              style={{
                backgroundColor: isActive ? undefined : accent,
                borderColor: isActive ? accent : undefined,
              }}
              aria-label={`Set theme to ${t}`}
              aria-pressed={isActive}
            >
              {isActive && <Check className="size-3.5 m-auto" style={{ color: accent }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { user, logout, hasCapability } = useAuth();
  const { theme, setTheme } = useReaderTheme();
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
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  if (pathname === '/login' || /^\/books\/[^/]+\/reader(?:\/|$)/.test(pathname)) return null;

  const links = user
    ? [
        ...publicLinks,
        ...(hasCapability(CAPABILITY.JOBS_LIST) ? adminLinks : []),
        ...(hasCapability(CAPABILITY.ADMIN_ACCESS) ? consoleLinks : []),
      ]
    : publicLinks;

  const navLinkClass = (active: boolean) =>
    cn(
      'rounded-md px-3 py-2 text-[0.85rem] font-semibold text-secondary no-underline transition hover:bg-surface-raised hover:text-primary',
      active && 'bg-surface-raised text-accent',
    );

  return (
    <header className="sticky top-0 z-[100] border-b border-default bg-app/80 backdrop-blur-[18px]">
      <div className="mx-auto flex min-h-[58px] w-full max-w-[1520px] items-center justify-between gap-4 px-5 py-2">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2.5 text-inherit no-underline">
          <span className="inline-flex size-[32px] items-center justify-center rounded-md bg-accent font-black text-inverse">
            N
          </span>
          <span className="whitespace-nowrap text-base font-bold text-primary">Books Library</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link.match(pathname))}>
              {link.label}
            </Link>
          ))}

          {user && <div className="mx-1.5 h-5 w-px bg-border" />}

          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex items-center justify-center rounded-md px-2 py-2 text-secondary transition hover:bg-surface-raised hover:text-primary"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-inverse">
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
                  <div className="absolute right-0 top-full z-dropdown mt-2 w-56 rounded-xl border border-default bg-dropdown p-1.5 shadow-elevation-4">
                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={cn(
                        navItemVariants(),
                        'font-semibold no-underline',
                        pathname.startsWith('/profile') && navItemActiveVariants(),
                      )}
                    >
                      <User className="size-4" />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={cn(
                        navItemVariants(),
                        'font-semibold no-underline',
                        pathname.startsWith('/settings') && navItemActiveVariants(),
                      )}
                    >
                      <Settings className="size-4" />
                      Settings
                    </Link>
                    <div className="my-1.5 h-px bg-border" />
                    <ThemePicker theme={theme} onChange={setTheme} />
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className={cn(
                        navItemVariants(),
                        'w-full text-left font-semibold hover:bg-danger/10 hover:text-danger',
                      )}
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
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-default bg-dropdown p-4 shadow-elevation-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  navItemVariants(),
                  'font-semibold no-underline py-2.5',
                  link.match(pathname) && navItemActiveVariants(),
                )}
              >
                {link.label}
              </Link>
            ))}

            {user && (
              <>
                <div className="my-2 h-px bg-border" />
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-secondary">
                  <User className="size-4" />
                  <span className="truncate">{user.username}</span>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    navItemVariants(),
                    'font-semibold no-underline py-2.5',
                    pathname.startsWith('/profile') && navItemActiveVariants(),
                  )}
                >
                  <User className="size-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    navItemVariants(),
                    'font-semibold no-underline py-2.5',
                    pathname.startsWith('/settings') && navItemActiveVariants(),
                  )}
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
                <div className="my-2 h-px bg-border" />
                <ThemePicker theme={theme} onChange={setTheme} />
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className={cn(
                    navItemVariants(),
                    'font-semibold text-left py-2.5 hover:bg-danger/10 hover:text-danger',
                  )}
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
                className="rounded-md bg-accent px-3 py-2.5 text-center text-sm font-semibold text-inverse no-underline transition hover:bg-accent-hover"
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
