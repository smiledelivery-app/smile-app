import type { Metadata } from 'next';
import { MarketingPage } from '../marketing';

export const metadata: Metadata = {
  title: 'Partner with Smile',
  description: 'Bring your kitchen or local business to more people by partnering with Smile.',
};

export default function VendorsPage(){return <MarketingPage kind="vendors"/>}
