import type { Metadata } from 'next';
import './styles.css';
import './marketing.css';

export const metadata: Metadata = { title: 'Smile — good food, on your time', description: 'Discover local kitchens and everyday essentials around you.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
