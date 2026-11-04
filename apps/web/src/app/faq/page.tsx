import type { Metadata } from 'next';
import { MarketingPage } from '../marketing';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'Find answers to common questions about ordering and using Smile.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage(){return <MarketingPage kind="faq"/>}
