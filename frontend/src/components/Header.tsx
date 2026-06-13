'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

const publicLinks = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  { href: '/authors', label: 'Authors', match: (pathname: string) => pathname.startsWith('/authors') },
];

const privateLinks = [
  { href: '/profile', label: 'Profile', match: (pathname: string) => pathname.startsWith('/profile') },
];

const adminLinks = [
  { href: '/scraper', label: 'Scrapers', match: (pathname: string) => pathname === '/scraper' },
];

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === '/login') return null;

  const links = user
    ? [...publicLinks, ...privateLinks, ...(user.role === 'admin' ? adminLinks : [])]
    : publicLinks;

  return (
    <header className="sticky top-0 z-[100] border-b border-border bg-[rgba(255,253,248,0.88)] shadow-[0_2px_18px_rgba(48,39,28,0.04)] backdrop-blur-[18px]">
      <div className="mx-auto flex min-h-[62px] w-full max-w-[1520px] items-center justify-between gap-4 px-5 py-2.5 max-[860px]:items-start max-[860px]:flex-col">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2.5 text-inherit no-underline">
          <span className="inline-flex size-[34px] items-center justify-center rounded-md bg-gradient-to-br from-primary to-[#263a5c] font-black text-white shadow-[0_9px_20px_rgba(64,95,143,0.22)]">
            N
          </span>
          <span className="whitespace-nowrap text-base font-black text-foreground">Novels Library</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-1 max-[860px]:w-full max-[860px]:justify-start">
          {links.map((link) => {
            const active = link.match(pathname);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 text-[0.86rem] font-bold text-copy no-underline transition hover:bg-primary-soft hover:text-foreground',
                  active && 'bg-primary-soft text-foreground shadow-[inset_0_-2px_0_var(--secondary)]',
                )}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="mx-1.5 h-5 w-px bg-border max-[860px]:hidden"></div>

          {user ? (
            <div className="inline-flex items-center gap-2.5 max-[860px]:w-full max-[860px]:justify-between">
              <span className="inline-flex items-center gap-1 text-[0.84rem] text-copy">
                <span>Hello,</span> <strong>{user.username}</strong>
              </span>
              <Button onClick={logout} variant="secondary" size="sm">
                Logout
              </Button>
            </div>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
