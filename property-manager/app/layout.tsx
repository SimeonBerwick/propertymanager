import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Property Manager V1',
  description: 'Maintenance command center for small landlords and property managers.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
