import type { Metadata } from 'next';
import { siteUrl } from '../lib/site';
import './styles.css';
import './marketing.css';

const description = 'Smile Delivery brings smile food delivery in Lagos to your door. Order food, groceries and everyday essentials from local businesses.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Smile Delivery | Food Delivery in Lagos',
    template: '%s | Smile',
  },
  description,
  keywords: ['Smile', 'Smile Delivery', 'Smile food', 'Smile food delivery', 'food delivery in Lagos'],
  applicationName: 'Smile',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Smile',
    title: 'Smile Delivery | Food Delivery in Lagos',
    description,
    url: '/',
    images: ['/smile-logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Smile Delivery | Food Delivery in Lagos',
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
