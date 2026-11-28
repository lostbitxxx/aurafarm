"use client";

import { useRouter } from "next/navigation";

export function PrivacyBackButton() {
  const router = useRouter();
  return (
    <div className="privacy-back-row">
      <button type="button" className="button button-ghost" onClick={() => router.back()}>
        Back
      </button>
    </div>
  );
}
