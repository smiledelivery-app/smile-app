import type { Metadata } from 'next';
import { siteUrl } from '../lib/site';
import './styles.css';
import './marketing.css';

const description = 'Smile is a food delivery app in Lagos. Order local food, groceries and everyday essentials with Smile Delivery.';

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
    images: ['/logo-transparent.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Smile Delivery | Food Delivery in Lagos',
    description,
    images: ['/logo-transparent.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-196.png', sizes: '196x196', type: 'image/png' },
    ],
    apple: '/icon.png',
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
