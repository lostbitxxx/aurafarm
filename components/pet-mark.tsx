import { SlimeMark } from "./slime-mark";

export function PetMark({
  petType,
  className = "slime-mark",
}: {
  petType: string;
  className?: string;
}) {
  if (petType === "lantern_moth") return <MothMark className={className} />;
  if (petType === "river_newt") return <NewtMark className={className} />;
  return <SlimeMark className={className} />;
}

function MothMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 160 140" aria-hidden="true">
      <ellipse cx="80" cy="122" rx="40" ry="8" fill="rgba(8, 16, 12, 0.28)" />
      <ellipse cx="80" cy="74" rx="52" ry="34" fill="rgba(227, 154, 69, 0.22)" />
      <path d="M80 76C56 76 26 58 22 38c18-8 40 6 58 32Z" fill="#e39a45" />
      <path d="M80 76c24 0 54-18 58-38-18-8-40 6-58 32Z" fill="#e39a45" />
      <path d="M80 90c-20 2-44 16-46-4 16-10 32-6 46 4Z" fill="#c47a2c" />
      <path d="M80 90c20 2 44 16 46-4-16-10-32-6-46 4Z" fill="#c47a2c" />
      <path d="M80 98c-5-30-5-52 0-66 5 14 5 36 0 66Z" fill="#14211a" />
      <path
        d="M74 38c-10-16-8-28 2-36"
        fill="none"
        stroke="#14211a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M86 38c10-16 8-28-2-36"
        fill="none"
        stroke="#14211a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="76" cy="4" r="2.5" fill="#f7f3e8" />
      <circle cx="84" cy="4" r="2.5" fill="#f7f3e8" />
      <circle cx="74" cy="68" r="2" fill="#f6f1e4" />
      <circle cx="86" cy="68" r="2" fill="#f6f1e4" />
    </svg>
  );
}

function NewtMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 160 140" aria-hidden="true">
      <ellipse cx="82" cy="122" rx="46" ry="8" fill="rgba(8, 16, 12, 0.28)" />
      <path d="M112 78c22-6 36 18 28 32-16-6-22-16-28-24Z" fill="#2a6270" />
      <path d="M40 72c2-20 28-28 62-16 18 6 24 24 12 36-22 16-62 12-74-8 0-6-2-10 0-12Z" fill="#3d8f8a" />
      <path d="M56 84c16 12 42 10 58-4-14 12-40 14-58 4Z" fill="#f6f1e4" />
      <path d="M62 90 52 112" fill="none" stroke="#2a6270" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 94 72 116" fill="none" stroke="#2a6270" strokeWidth="4" strokeLinecap="round" />
      <path d="M98 88 108 110" fill="none" stroke="#2a6270" strokeWidth="4" strokeLinecap="round" />
      <circle cx="54" cy="64" r="4.5" fill="#14211a" />
      <circle cx="55.5" cy="62.5" r="1.5" fill="#f7f3e8" />
      <circle cx="86" cy="66" r="3" fill="#14211a" opacity="0.5" />
      <circle cx="100" cy="74" r="2.2" fill="#14211a" opacity="0.4" />
    </svg>
  );
}
