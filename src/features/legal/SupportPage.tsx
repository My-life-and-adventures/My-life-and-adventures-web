import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './legal.css';

const CONTACT_EMAIL = 'support@mylife-and-adventures.com';

type Faq = { q: string; a: React.ReactNode };

const FAQS: Faq[] = [
  {
    q: 'How do I record a story?',
    a: (
      <>
        Open the Record tab and tap the microphone. The app walks you through
        choosing a chapter of your life, giving the story a short title, picking
        who it’s for, and choosing when they receive it. Then you record. You can
        watch it back and record again as many times as you like before saving.
      </>
    ),
  },
  {
    q: 'Who can see my stories?',
    a: (
      <>
        Only the people you choose. For each story you select which of your
        family members or friends may watch it, and when they receive it — right
        away, on a future date, or after you pass away. You can change this later
        from the story’s details screen.
      </>
    ),
  },
  {
    q: 'Can I use my own photos in a story?',
    a: (
      <>
        Yes. Add photos to your image library from the Images tab, then bring them
        on screen while you’re recording. You can crop and rename them at any
        time.
      </>
    ),
  },
  {
    q: 'How do I add a family member?',
    a: (
      <>
        Go to the Family tab and tap “Add someone”. You’ll enter their name and
        email address so your stories can be delivered to them. You can also mark
        someone as your inheritor, or as your notary / executor.
      </>
    ),
  },
  {
    q: 'Can I save my stories to my phone?',
    a: (
      <>
        Yes. From Settings you can unlock your library, then save any story to
        your phone’s photo library. Stories are saved one at a time.
      </>
    ),
  },
  {
    q: 'How do I manage or cancel my subscription?',
    a: (
      <>
        Subscriptions are billed through your Apple ID. Open the iOS Settings app,
        tap your name, then Subscriptions, and choose My Life &amp; Adventures.
        Cancelling at least 24 hours before the renewal date stops the next
        charge; you keep access until the end of the period you’ve paid for.
      </>
    ),
  },
  {
    q: 'I have a promotion code.',
    a: (
      <>
        Open Settings, then “Promotion code” under Additional services, and enter
        it there.
      </>
    ),
  },
  {
    q: 'I forgot my password.',
    a: (
      <>
        Tap “Forgot your password?” on the sign-in screen and we’ll email you a
        reset link.
      </>
    ),
  },
  {
    q: 'How do I change the app’s language?',
    a: (
      <>
        Settings, then Account, then Language. The app is available in English and
        French.
      </>
    ),
  },
  {
    q: 'How do I delete my account?',
    a: (
      <>
        Settings, then “Delete my account” at the bottom. This permanently removes
        your account and your stories. Please download anything you want to keep
        first — deletion cannot be undone.
      </>
    ),
  },
  {
    q: 'My story says it’s still processing.',
    a: (
      <>
        Videos are prepared after you finish recording, which can take a few
        minutes. You’ll get a notification when the story is ready to watch. If a
        story is still processing after an hour, please contact us.
      </>
    ),
  },
];

export function SupportPage() {
  useEffect(() => {
    document.title = 'Support · My Life and Adventures';
  }, []);

  return (
    <article className="legal-page">
      <header className="legal-header">
        <p className="viewer-eyebrow">Help</p>
        <h1>Support</h1>
        <p className="legal-updated">
          We’re here to help. Most questions are answered below.
        </p>
      </header>

      <div className="legal-card">
        <div className="legal-note">
          <strong>Contact us</strong>
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim
            to reply within two business days.
          </p>
          <p>
            When you write, it helps to tell us your account email, your device
            (for example iPhone 14), and what you were doing when the problem
            happened.
          </p>
        </div>

        <section className="legal-section">
          <h2>Frequently asked questions</h2>
          <dl className="legal-faq">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <dt>{faq.q}</dt>
                <dd>{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="legal-section">
          <h2>Privacy</h2>
          <p>
            Read our <Link to="/privacy">Privacy Policy</Link> to see what we
            collect and how it is used.
          </p>
        </section>

        <footer className="legal-footer">
          <p>© 2026 Claude Martel. All rights reserved.</p>
        </footer>
      </div>
    </article>
  );
}
