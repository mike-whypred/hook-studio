import type { Metadata } from "next";
import { FONT_SHEETS } from "./fonts";
import "./globals.css";
import "./studio/studio.css";

export const metadata: Metadata = {
  title: "Hook Studio",
  description: "Write scroll-stopping on-screen hooks and make every version of your Reel in the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {FONT_SHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
