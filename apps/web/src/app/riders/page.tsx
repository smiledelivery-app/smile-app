import type { Metadata } from 'next';
import { MarketingPage } from '../marketing';

export const metadata: Metadata = {
  title: 'Ride with Smile',
  description: 'Learn about delivering with Smile and helping bring local orders to customers.',
  alternates: { canonical: '/riders' },
};

export default function RidersPage(){return <MarketingPage kind="riders"/>}
