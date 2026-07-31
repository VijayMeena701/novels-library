import type { Metadata, Viewport } from 'next';
import { Inter, Literata } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { FeatureFlagsProvider } from '../context/FeatureFlagsContext';
import { ToastProvider } from '../context/ToastContext';
import { ReaderThemeProvider } from '../context/ReaderThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Header from '../components/Header';
import { QueryProvider } from '../components/providers/QueryProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const literata = Literata({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-literata',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Books Library',
  description:
    'Track, read, and archive web books. A personal library with a clean reader, TTS, and automatic chapter archiving.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${literata.variable}`}>
      <body className="min-h-screen">
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <FeatureFlagsProvider>
                <ReaderThemeProvider>
                  <ErrorBoundary name="Navigation">
                    <Header />
                  </ErrorBoundary>
                  <main className="flex min-h-[calc(100vh-4rem)] flex-col">
                    <ErrorBoundary name="Page content">{children}</ErrorBoundary>
                  </main>
                </ReaderThemeProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
