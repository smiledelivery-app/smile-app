import type { Metadata } from 'next';
import { Footer, Header } from '../marketing';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how Smile Delivery collects, uses, shares, and protects personal information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="smile-site s-inner">
      <Header />
      <main>
        <article className="s-legal">
          <h1>Privacy Policy</h1>
          <p className="s-legal-date">Last updated: November 4, 2026</p>

          <p>
            This policy explains how Smile collects and uses information when you visit
            smiledelivery24.com or use Smile customer, vendor, and rider services. It applies to
            customers placing orders, businesses using Smile to manage listings and orders, and
            riders using Smile delivery tools.
          </p>

          <section>
            <h2>Information we collect</h2>
            <ul>
              <li>
                <strong>Account details:</strong> name, email address, phone number, password
                credentials, account roles, and phone-verification status.
              </li>
              <li>
                <strong>Orders and support:</strong> items ordered, order and delivery status,
                delivery notes, cancellation reasons, support requests, and related
                communications.
              </li>
              <li>
                <strong>Addresses and location:</strong> saved delivery addresses and coordinates.
                If you use rider features, the app may collect your location while you are actively
                online or completing a delivery. Rider location sharing is foreground-only; the app
                does not request background location.
              </li>
              <li>
                <strong>Vendor information:</strong> business name, description, address, contact
                details, opening hours, product and menu information, images, and application or
                business-registration details and documents you submit.
              </li>
              <li>
                <strong>Rider information:</strong> application and profile details such as date of
                birth, vehicle and plate details, service area, residential and guarantor details,
                identity information, and payout details where requested for rider onboarding or
                payment.
              </li>
              <li>
                <strong>Payment and wallet records:</strong> transaction amounts, status,
                references, and limited account or payout information needed to operate payment
                features. Payment providers may collect payment credentials directly.
              </li>
              <li>
                <strong>Service and security records:</strong> sign-in sessions and records needed
                to secure accounts, investigate problems, and maintain the service.
              </li>
            </ul>
          </section>

          <section>
            <h2>How we use information</h2>
            <p>
              We use information to create and manage accounts; verify phone numbers; show stores
              and products; receive and fulfill orders; coordinate pickup and delivery; calculate
              routes; provide support; administer vendor and rider applications; process payments
              or payouts where those features are enabled; protect the service; and meet legal,
              accounting, and safety requirements.
            </p>
          </section>

          <section>
            <h2>When we share information</h2>
            <p>
              We share only information needed to operate Smile, including with the people and
              providers involved in a transaction:
            </p>
            <ul>
              <li>
                The business fulfilling an order receives the order details and information needed
                to prepare it.
              </li>
              <li>
                The rider assigned to a delivery receives the delivery details and customer
                location information needed to complete that delivery.
              </li>
              <li>
                Mapping providers, such as Google Maps or OpenRouteService, may receive an address
                or coordinates when geocoding an address or calculating a route.
              </li>
              <li>
                Phone-verification providers may process your phone number and verification
                request. Payment and banking providers, including Paystack where configured, may
                process payment or payout information.
              </li>
              <li>
                Hosting, database, and other service providers process information for us to run
                Smile. We may also disclose information when required by law or to protect people,
                rights, and the service.
              </li>
            </ul>
            <p>
              Vendor names, business descriptions, business locations, menus, and other listing
              information intended for customers may be publicly visible. We do not sell personal
              information.
            </p>
          </section>

          <section>
            <h2>Payments</h2>
            <p>
              The current demo checkout is restricted to non-production environments and does not
              charge real money. Where real payment or wallet features are enabled, third-party
              payment and banking providers process the relevant transactions under their own
              privacy terms. Smile receives transaction records and references needed to manage
              orders, wallets, and support; do not send full card details to Smile by email or
              support message.
            </p>
          </section>

          <section>
            <h2>Location and mapping</h2>
            <p>
              Customer addresses may be geocoded to support delivery. Riders can share their
              location while using rider services so Smile can offer and coordinate deliveries.
              Google-derived geocoded coordinates are refreshed or removed after 30 days; the
              address you supplied remains available for the service. You can turn off location
              permission in your device settings, although some rider features will then be
              unavailable.
            </p>
          </section>

          <section>
            <h2>Retention and account deletion</h2>
            <p>
              We keep information for as long as needed to provide Smile, manage orders and
              accounts, resolve disputes, protect the service, and meet legal or accounting
              requirements. When a customer account is deleted, direct profile details are removed
              and saved addresses are anonymized. Order, payment, safety, and audit records may be
              retained where needed for the purposes above. Vendor and rider accounts should
              contact support to close because their business or delivery records may need separate
              handling.
            </p>
          </section>

          <section>
            <h2>Your choices and privacy requests</h2>
            <p>
              You can update account details and saved addresses through the app. You may request
              access to, correction of, or deletion of your personal information by emailing{' '}
              <a href="mailto:hello@smile.delivery">hello@smile.delivery</a>. We may need to verify
              your identity before acting on a request and may retain information where the law
              permits or requires it.
            </p>
          </section>

          <section>
            <h2>Security and changes</h2>
            <p>
              We use safeguards intended to protect information, but no online service can
              guarantee absolute security. We may update this policy as Smile changes. The date at
              the top shows when it was most recently revised.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              For privacy questions or requests, contact{' '}
              <a href="mailto:hello@smile.delivery">hello@smile.delivery</a>.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
