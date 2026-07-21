import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSafeReturnUrl(value: string | null | undefined, fallback = '/profile'): string {
  if (!value) return fallback;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const decoded = decodeURIComponent(value);
    const url = new URL(decoded, base);
    if (url.origin !== base) return fallback;
    if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getLoginHref(pathname: string): string {
  if (!pathname || pathname === '/login') return '/login';
  return `/login?from=${encodeURIComponent(pathname)}`;
}
