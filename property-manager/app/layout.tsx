import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Property Manager Tenant App',
    template: '%s · Property Manager Tenant App',
  },
  description: 'Secure tenant access for maintenance requests, updates, and issue reporting.',
  applicationName: 'Property Manager Tenant App',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PM Tenant',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
