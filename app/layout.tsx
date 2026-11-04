import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: [{url: "/favicon.svg", type: "image/svg+xml"}, {url: "/favicon.ico", sizes: "32x32"}], apple: "/apple-touch-icon.png" },
  applicationName: "Hearth",
  manifest: "/site.webmanifest",
  title: "Hearth - A little clarity for the people you love",
  description:
    "A private family plan for care, inheritance and giving. Prepare thoughtfully, keep arrangements current, and help authorised people take the next step.",
};
export const viewport = { themeColor: "#793f5d" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
