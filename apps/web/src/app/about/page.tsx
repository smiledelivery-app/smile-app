import type { Metadata } from 'next';
import { MarketingPage } from '../marketing';

export const metadata: Metadata = {
  title: 'About Smile',
  description: 'Learn how Smile helps you discover local kitchens and everyday essentials.',
  alternates: { canonical: '/about' },
};

export default function AboutPage(){return <MarketingPage kind="about"/>}
