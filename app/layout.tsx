import type { Metadata } from "next";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/nunito-sans";
import { SiteChrome } from "@/components/SiteChrome";
import { THEME_INIT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peep — your sponsorship campaign manager",
  description: "Peep turns any pitch into a polished campaign and pairs it with brands and donors whose giving funds are verified and ready.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
