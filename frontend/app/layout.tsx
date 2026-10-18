import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'EventBook',
  description: 'Browse events and book your seat.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="container page">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
