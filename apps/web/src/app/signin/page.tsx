import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Choose how to continue',
  description: 'Continue to Smile as a customer, rider, or vendor.',
  alternates: { canonical: '/signin' },
};

const roles = [
  {
    title: 'Customer',
    description: 'Discover food and local favourites, then track your delivery.',
    href: 'https://customer.smiledelivery24.com/',
    action: 'Continue as customer',
    symbol: '⌕',
  },
  {
    title: 'Rider',
    description: 'Manage delivery offers and your rider account.',
    href: 'https://operations.smiledelivery24.com/',
    action: 'Continue as rider',
    symbol: '↗',
  },
  {
    title: 'Vendor',
    description: 'Manage your store, products, and incoming orders.',
    href: 'https://operations.smiledelivery24.com/',
    action: 'Continue as vendor',
    symbol: '⌂',
  },
];

export default function SignInPage() {
  return (
    <main className="s-signin">
      <Link className="s-signin-brand" href="/" aria-label="Smile home">
        <Image src="/smile-logo.png" width={34} height={34} alt="" priority />
        <span>smile<i>.</i></span>
      </Link>
      <section className="s-signin-content" aria-labelledby="signin-title">
        <span className="s-signin-eyebrow">WELCOME TO SMILE</span>
        <h1 id="signin-title">How would you like to continue?</h1>
        <p>Choose the Smile experience that’s right for you.</p>
        <div className="s-signin-roles">
          {roles.map((role) => (
            <article className="s-signin-role" key={role.title}>
              <span className="s-signin-symbol" aria-hidden="true">{role.symbol}</span>
              <h2>{role.title}</h2>
              <p>{role.description}</p>
              <Link href={role.href}>
                {role.action}<span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
        <Link className="s-signin-back" href="/">← Back to Smile home</Link>
      </section>
    </main>
  );
}
