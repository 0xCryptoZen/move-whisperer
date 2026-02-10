import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MoveWhisperer',
  description: 'MoveWhisperer - The AI that speaks Move',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} ${jetbrainsMono.variable}`}>
        <Providers>
          {/* Cyber grid background */}
          <div className="fixed inset-0 cyber-grid-bg pointer-events-none z-0" />

          {/* Subtle scanline overlay */}
          <div className="scanline-overlay pointer-events-none" />

          {/* CRT vignette */}
          <div className="crt-vignette pointer-events-none" />

          <div className="relative z-10 min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
