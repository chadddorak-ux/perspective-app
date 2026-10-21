import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perspective — sponsorship matching",
  description: "Match nonprofits and events with the brands and donors most likely to say yes.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
