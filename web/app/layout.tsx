import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'auto-sui-skills',
  description: 'Auto-generate Claude skills from Sui Move contracts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {/* Animated background orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="bg-orb w-[600px] h-[600px] bg-primary/20 -top-[200px] -left-[200px]" />
            <div className="bg-orb w-[500px] h-[500px] bg-accent/10 top-[40%] -right-[150px]" style={{ animationDelay: '-5s' }} />
            <div className="bg-orb w-[400px] h-[400px] bg-primary/15 bottom-[10%] left-[20%]" style={{ animationDelay: '-10s' }} />
          </div>

          <div className="relative z-10 min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
