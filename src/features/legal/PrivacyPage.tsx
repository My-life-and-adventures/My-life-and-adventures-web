import { useEffect } from 'react';
import './legal.css';

const CONTACT_EMAIL = 'privacy@educonsellium.com';

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy · My Life and Adventures';
  }, []);

  return (
    <article className="legal-page">
      <header className="legal-header">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">
          My Life and Adventures — Last updated: 3 July 2026
        </p>
      </header>

      <div className="legal-card">
        <p className="legal-intro">
          This Privacy Policy explains how Educonsellium (“we”, “us”, or “our”)
          collects, uses, and protects your information when you use the My Life
          and Adventures mobile application and related services (the “App”). The
          App lets you record, preserve, and share personal video life-stories
          with the people you choose.
        </p>

        <p className="legal-note">
          Before you publish: replace the bracketed placeholders below (contact
          email, legal entity, and mailing address) with your real details, then
          host this file at a public URL and enter that URL in App Store Connect.
        </p>

        <section className="legal-section">
          <h2>1. Information We Collect</h2>

          <h3>Information you provide</h3>
          <ul>
            <li>
              <strong>Account &amp; profile:</strong> first and last name, email
              address, nickname or username, password, date of birth, place of
              birth, biography, profile photo, and preferred language.
            </li>
            <li>
              <strong>Your content:</strong> the video stories you record, photos
              you add, and titles, descriptions, and scheduling you set for each
              story.
            </li>
            <li>
              <strong>Story recipients:</strong> the names, email addresses, phone
              numbers, and relationship you provide for the people you choose to
              receive your stories — including anyone you designate as an
              inheritor or notary/executor.
            </li>
            <li>
              <strong>Support communications:</strong> messages and feedback you
              send us.
            </li>
          </ul>

          <h3>Information collected automatically</h3>
          <ul>
            <li>
              <strong>Device &amp; usage:</strong> device type, operating system,
              app version, and basic usage events needed to operate and improve
              the App.
            </li>
            <li>
              <strong>Push notification tokens:</strong> a device identifier used
              to deliver notifications (for example, when a story becomes
              available).
            </li>
            <li>
              <strong>Subscription &amp; purchase records:</strong> your plan
              tier, transaction identifiers, and purchase status. We do not
              receive or store your full payment card details.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>
              <strong>Provide the App:</strong> create your account, store and
              process your recordings, and deliver stories to the recipients you
              choose.
            </li>
            <li>
              Process subscriptions and one-time purchases, including downloads.
            </li>
            <li>
              Send service communications and notifications you have enabled.
            </li>
            <li>Provide customer support and respond to your requests.</li>
            <li>
              Maintain security, prevent fraud and abuse, and comply with legal
              obligations.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. How Stories Are Shared</h2>
          <p>
            Your stories are private by default. A story is only made available to
            a recipient when you choose to share it — either immediately, on a
            scheduled date, or, where you have set it up, upon a designated event.
            Recipients access stories through a secure link and verification step.
            You control who your recipients are and can update them.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Service Providers We Use</h2>
          <p>
            We share limited information with trusted providers who process it on
            our behalf:
          </p>
          <table className="legal-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Secure hosting of your account, content, and database</td>
              </tr>
              <tr>
                <td>Apple (App Store)</td>
                <td>App distribution and in-app subscription billing</td>
              </tr>
              <tr>
                <td>RevenueCat</td>
                <td>Managing and validating in-app subscriptions</td>
              </tr>
              <tr>
                <td>Stripe</td>
                <td>Processing one-time download payments</td>
              </tr>
              <tr>
                <td>Expo</td>
                <td>Delivering push notifications</td>
              </tr>
              <tr>
                <td>Email delivery provider</td>
                <td>Sending story links, sign-in codes, and notifications</td>
              </tr>
            </tbody>
          </table>
          <p>
            These providers are authorized to use your information only as needed
            to perform their services and are bound to protect it.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Payments</h2>
          <p>
            Subscriptions are billed through your Apple ID and handled by Apple in
            accordance with Apple’s terms. One-time downloads are processed by
            Stripe. Payment card details are entered with, and held by, those
            payment processors — not by us.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Data Retention</h2>
          <p>
            We keep your information for as long as your account is active or as
            needed to provide the App. You may request deletion of your account
            and content at any time (see “Your Rights”). We may retain certain
            records where required for legal, tax, or fraud-prevention purposes.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Your Rights</h2>
          <p>
            Depending on where you live, you may have the right to:
          </p>
          <ul>
            <li>Access the personal information we hold about you;</li>
            <li>Correct inaccurate information;</li>
            <li>Request deletion of your account and content;</li>
            <li>Object to or restrict certain processing;</li>
            <li>Request a copy of your information in a portable format.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Security</h2>
          <p>
            We use administrative, technical, and physical safeguards to protect
            your information, including encryption in transit and access controls.
            No method of transmission or storage is completely secure, but we work
            to protect your data and continually improve our safeguards.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Children’s Privacy</h2>
          <p>
            The App is not directed to children under 13, and we do not knowingly
            collect personal information from children under 13. If you believe a
            child has provided us information, contact us and we will delete it.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. International Users</h2>
          <p>
            Your information may be processed and stored in countries other than
            your own, which may have different data-protection laws. Where
            required, we take steps to ensure your information receives an adequate
            level of protection.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Policy from time to time. We will revise the “Last
            updated” date above and, where appropriate, notify you within the App.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Contact Us</h2>
          <p>
            If you have questions about this Policy or your information, contact us
            at:
          </p>
          <p>
            Educonsellium
            <br />
            Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <br />
            Address: [Your mailing address]
          </p>
        </section>

        <footer className="legal-footer">
          <p>© 2026 Educonsellium. All rights reserved.</p>
        </footer>
      </div>
    </article>
  );
}
