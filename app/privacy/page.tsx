import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="paper-shell">
      <PublicHeader />
      <main className="paper-main">
        <p className="eyebrow">Privacy</p>
        <h1>What the pet can see.</h1>
        <p className="lede">
          During a study session you started, the pet reads the address bar of the frontmost
          browser window.
        </p>
        <ul className="steps">
          <li>It does not read background tabs, page contents, or passwords.</li>
          <li>
            During a desktop study session, it comes forward and closes that front tab
            after 1 minute on a blocklist host.
          </li>
          <li>
            The server stores the duration, the experience, and the blocked hostnames for that
            session.
          </li>
          <li>Stopping the session or quitting the pet stops the address-bar check.</li>
        </ul>
      </main>
    </div>
  );
}
