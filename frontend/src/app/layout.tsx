import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Header from '../components/Header';

export const metadata: Metadata = {
  title: 'Books Library',
  description: 'Track, read, and archive web books. A personal library with a clean reader, TTS, and automatic unit archiving.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f3f1eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary name="Navigation">
              <Header />
            </ErrorBoundary>
            <main className="flex min-h-[calc(100vh-4rem)] flex-col">
              <ErrorBoundary name="Page content">{children}</ErrorBoundary>
            </main>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
