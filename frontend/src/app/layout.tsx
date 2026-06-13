import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import Header from '../components/Header';

export const metadata: Metadata = {
  title: 'Novels Library & Crawler Archiver',
  description: 'Track read novels, logs history, and automatically download and archive offline chapters.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <AuthProvider>
          <Header />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
