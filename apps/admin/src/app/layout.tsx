import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Smile',
  description: 'Operations and financial oversight for the Smile delivery platform.',
  icons: { icon: '/smile-logo.png', apple: '/smile-logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
