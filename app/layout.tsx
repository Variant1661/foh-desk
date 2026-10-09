import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOH desk",
  description: "Share 24-hour messages and record FOH timesheet hours.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
