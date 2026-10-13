import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FamilieQuest ⚔️',
  description: 'Gør huslige pligter til et eventyr',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className="h-full bg-slate-900">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}