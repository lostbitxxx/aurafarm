"use client";

export function CloseDeskTab({ children }: { children: string }) {
  return (
    <button type="button" className="button" onClick={() => window.close()}>
      {children}
    </button>
  );
}
