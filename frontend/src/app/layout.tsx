import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ReaderThemeProvider } from '../context/ReaderThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Header from '../components/Header';
import { QueryProvider } from '../components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'Books Library',
  description: 'Track, read, and archive web books. A personal library with a clean reader, TTS, and automatic chapter archiving.',
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
    <html lang="en" className="h-full">
      <body className="min-h-screen">
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <ReaderThemeProvider>
                <ErrorBoundary name="Navigation">
                  <Header />
                </ErrorBoundary>
                <main className="flex min-h-[calc(100vh-4rem)] flex-col">
                  <ErrorBoundary name="Page content">{children}</ErrorBoundary>
                </main>
              </ReaderThemeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
