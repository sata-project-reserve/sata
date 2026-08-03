import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sata-project-reserve.github.io'),
  title: {
    default: 'SATA Reserve Token',
    template: '%s | SATA Reserve Token'
  },
  description:
    'SATA Reserve Token is a Bitcoin-aligned Solana transparency experiment publishing public reserve, liquidity, authority, and founder-distribution reports.',
  alternates: {
    canonical: '/sata'
  },
  openGraph: {
    title: 'SATA Reserve Token',
    description:
      'Bitcoin-aligned Solana transparency experiment. Proof over promises; no redemption or price guarantee.',
    url: 'https://sata-project-reserve.github.io/sata',
    siteName: 'SATA Reserve Token',
    images: ['/sata/sata-x-header.png'],
    type: 'website'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
