import type { Metadata } from 'next';
import { MarketingPage } from '../marketing';

export const metadata: Metadata = {
  title: 'Contact Smile',
  description: 'Get in touch with the Smile team for help, questions, or partnership enquiries.',
};

export default function ContactPage(){return <MarketingPage kind="contact"/>}
