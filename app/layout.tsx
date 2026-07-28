import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SATA Token Launcher',
  description: 'Local safety-first Solana token launch dashboard for SATA.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
