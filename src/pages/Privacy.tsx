import React from "react";
import "./Privacy.css";

const Privacy: React.FC = () => {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <div className="privacy-logo">4Later</div>
          <h1>Privacy Policy</h1>
          <p className="privacy-effective">Effective date: March 18, 2026</p>
        </header>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to 4Later ("we", "our", or "us"). 4Later is a personal
            content-saving app that lets you save links, tweets, TikToks,
            Instagram posts, Reddit threads, Threads posts, and other media so
            you can revisit them later. This Privacy Policy explains what data
            we collect, how we use it, and your rights.
          </p>
        </section>

        <section>
          <h2>2. Data We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you sign in with Google, Facebook, or email/password, we
            receive basic profile information (name, email address, profile
            photo) from the authentication provider. We store this in Firebase
            Authentication.
          </p>

          <h3>Content You Save</h3>
          <p>
            URLs, titles, descriptions, thumbnails, and metadata of the content
            you choose to save are stored in Firebase Firestore under your
            account. This data is private to you and not shared with other
            users.
          </p>

          <h3>Social Connections (Optional)</h3>
          <p>
            If you connect your Threads account, we store an access token
            provided by Meta in your account record. This token is used solely
            to fetch rich previews of Threads posts you save. We do not post,
            like, follow, or take any action on your behalf.
          </p>

          <h3>Usage Data</h3>
          <p>
            If you consent, we use Google Analytics to measure aggregate app
            usage such as page views, navigation patterns, and feature
            engagement. We do not use Google Analytics to read the private
            content you save. Firebase Authentication may also use essential
            cookies for session management.
          </p>
        </section>

        <section>
          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To authenticate you and maintain your session</li>
            <li>To store and retrieve the content you save</li>
            <li>
              If you opt in, to understand overall app usage and improve the
              product experience
            </li>
            <li>
              To fetch metadata (title, description, preview image) for URLs you
              save — this is done server-side and the URL is sent to our Vite
              proxy endpoint
            </li>
            <li>
              To display rich previews of Threads posts using your optional
              Threads access token
            </li>
          </ul>
          <p>We do not sell, rent, or share your data with third parties.</p>
        </section>

        <section>
          <h2>4. Third-Party Services</h2>
          <ul>
            <li>
              <strong>Firebase (Google)</strong> — Authentication and database
              hosting.{" "}
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Firebase Privacy
              </a>
            </li>
            <li>
              <strong>Google Analytics</strong> — Used to understand app usage
              and improve product performance.{" "}
              <a
                href="https://support.google.com/analytics/answer/7318509"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Privacy
              </a>
            </li>
            <li>
              <strong>Meta Threads API</strong> — Used only when you explicitly
              connect your Threads account to fetch post previews.{" "}
              <a
                href="https://privacycenter.instagram.com/policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta Privacy
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p>
            Your saved content and account data are retained for as long as your
            account exists. You can delete your account at any time from the app
            settings, which permanently removes all your data from our database.
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            All data is transmitted over HTTPS. Firebase Firestore security
            rules ensure that only authenticated users can read or write their
            own data. Access tokens for social connections are stored in your
            private Firestore document and are never exposed to other users.
          </p>
        </section>

        <section>
          <h2>7. Children's Privacy</h2>
          <p>
            4Later is not directed at children under 13. We do not knowingly
            collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data at any time by contacting us or deleting your account
            in-app.
          </p>
        </section>

        <section>
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with a new effective date.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, please open an
            issue or contact us through the app.
          </p>
        </section>

        <footer className="privacy-footer">
          <a href="/login">Back to 4Later</a>
        </footer>
      </div>
    </div>
  );
};

export default Privacy;
