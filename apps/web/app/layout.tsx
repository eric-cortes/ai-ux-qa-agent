import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI UX QA Agent",
  description: "Local dashboard for QA runs"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject attributes on <body> before hydration,
          which harmlessly mismatches the server HTML. Scoped to <body> only. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
