"use client";

import { useEffect, useState } from "react";
import { readPetPresence } from "@/lib/actions/pet-presence";

export function PetStatus({
  downloadUrl,
  running: initialRunning,
  presenceError,
  pollMs,
}: {
  downloadUrl: string | null;
  running: boolean;
  presenceError: string | null;
  pollMs: number;
}) {
  const [seenRunning, setSeenRunning] = useState(initialRunning);
  const [running, setRunning] = useState(initialRunning);
  const [token, setToken] = useState("");
  const [pairUrl, setPairUrl] = useState("");
  const [error, setError] = useState<string | null>(presenceError);
  const [pending, setPending] = useState(false);

  if (initialRunning !== seenRunning) {
    setSeenRunning(initialRunning);
    setRunning(initialRunning);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      void readPetPresence().then((result) => {
        setRunning(result.running);
      });
    }, pollMs);
    return () => clearInterval(timer);
  }, [pollMs]);

  async function onPair() {
    if (pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/pet/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Mac pet" }),
    });
    const body = (await response.json().catch(() => null)) as
      | { token?: string; url?: string; error?: string }
      | null;
    setPending(false);
    if (!response.ok || !body?.token || !body.url) {
      setError(body?.error ?? "The pet could not be paired.");
      return;
    }
    setToken(body.token);
    setPairUrl(body.url);
  }

  return (
    <section className="pet-status" aria-label="Desktop pet">
      <div className="inventory-heading">
        <h2>Desktop pet</h2>
        <p>{running ? "Pet is running." : "Pet is not running."}</p>
      </div>
      {downloadUrl ? (
        <a className="button" href={downloadUrl}>
          Download the Mac pet
        </a>
      ) : (
        <p>
          The desktop build is not published yet. An unsigned Mac app is blocked until you
          right-click it and choose Open. Then pair this computer.
        </p>
      )}
      <button type="button" className="button" disabled={pending} onClick={onPair}>
        {pending ? "Pairing…" : "Pair this computer"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {token ? (
        <div className="pair-token">
          <p>This token is shown once. Open the link so the pet can save it.</p>
          <a className="launch-link" href={pairUrl}>
            {pairUrl}
          </a>
          <p className="launch-code">{token}</p>
        </div>
      ) : null}
    </section>
  );
}
