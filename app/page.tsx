import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PixelPetArt } from "@/components/pixel-pet";

export default function HomePage() {
  return (
    <div className="paper-shell">
      <PublicHeader />
      <main className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your study companion</p>
          <h1>A little companion for your study time.</h1>
          <p className="lede">Make time to focus with a cozy companion by your side.</p>
          <div className="hero-actions">
            <Link href="/register" className="button">
              Create account
            </Link>
            <Link href="/login" className="button button-ghost">
              Sign in
            </Link>
          </div>
        </div>
        <div className="hero-stage">
          <PixelPetArt petType="baby_slime" className="hero-pet-art" alt="" />
          <p>Your future study buddy</p>
        </div>
      </main>
    </div>
  );
}
