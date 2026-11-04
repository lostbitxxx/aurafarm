export function SlimeMark({ className = "slime-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 140" aria-hidden="true">
      <ellipse cx="80" cy="122" rx="46" ry="10" fill="rgba(8, 16, 12, 0.28)" />
      <path
        d="M28 78c0-36 20-62 52-62s52 26 52 62c0 22-12 38-52 38S28 100 28 78z"
        fill="#c6ef4a"
      />
      <path
        d="M48 58c8-16 20-24 34-20"
        fill="none"
        stroke="#f4ffe0"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="62" cy="78" r="6" fill="#14211a" />
      <circle cx="98" cy="78" r="6" fill="#14211a" />
      <circle cx="64" cy="76" r="2" fill="#f7f3e8" />
      <circle cx="100" cy="76" r="2" fill="#f7f3e8" />
      <path
        d="M70 94c6 6 16 6 22 0"
        fill="none"
        stroke="#14211a"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
