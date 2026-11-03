import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Hearth — A little clarity for the people you love",
  description:
    "A private family plan for care, inheritance and giving. Prepare thoughtfully, keep arrangements current, and help authorised people take the next step.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
