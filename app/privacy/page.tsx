import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main className="hero">
        <div className="panel hero-copy">
          <p className="eyebrow">Privacy</p>
          <h1>What the pet can see.</h1>
          <p className="lede">
            During a study session you started, the pet reads the address bar of the frontmost
            browser window.
          </p>
          <ul className="steps">
            <li>It does not read background tabs, page contents, or passwords.</li>
            <li>
              When close blocked tabs is on, it closes that front tab after 8 seconds on a
              blocklist host. It does not close any other tab.
            </li>
            <li>
              The server stores the score, the duration, the blocked count, and the blocked
              hostnames for that session.
            </li>
            <li>Stopping the session or quitting the pet stops the address-bar check.</li>
          </ul>
        </div>
      </main>
    </>
  );
}
