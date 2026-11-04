import type { Metadata } from 'next';
import { siteUrl } from '../lib/site';
import './styles.css';
import './marketing.css';

const description = 'Discover local kitchens and everyday essentials around you with Smile.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Smile — good food, on your time',
    template: '%s | Smile',
  },
  description,
  applicationName: 'Smile',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Smile',
    title: 'Smile — good food, on your time',
    description,
    url: '/',
    images: ['/smile-logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Smile — good food, on your time',
    description,
    images: ['/smile-logo.png'],
  },
  icons: {
    icon: '/smile-logo.png',
    apple: '/smile-logo.png',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const websiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Smile',
    url: siteUrl.origin,
    description,
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData).replace(/</g, '\\u003c') }}
        />
        {children}
      </body>
    </html>
  );
}
