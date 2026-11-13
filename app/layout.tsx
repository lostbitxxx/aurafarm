import type { Metadata } from "next";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Aurafarm",
    template: "%s · Aurafarm",
  },
  description: "Sign up, raise a baby slime, and equip it on your desk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
