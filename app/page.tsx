import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { SlimeMark } from "@/components/slime-mark";

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Desktop terrarium</p>
          <h1>A baby slime moves in when you do.</h1>
          <p className="lede">
            Create an account and Aurafarm saves your profile, then places a level 1 baby
            slime on the desktop with the slot already switched on.
          </p>
          <ol className="steps">
            <li>Sign up with your email.</li>
            <li>A baby slime joins your inventory at level 1.</li>
            <li>Equip to Desktop whenever you want a different pet in the frame.</li>
          </ol>
          <div className="hero-actions">
            <Link href="/register" className="button">
              Create account
            </Link>
            <Link href="/login" className="button button-ghost">
              Sign in
            </Link>
          </div>
        </div>
        <div className="panel hero-stage">
          <SlimeMark />
          <p>baby_slime · level 1 · on the desktop</p>
        </div>
      </main>
    </>
  );
}
