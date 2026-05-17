import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MiniFlow — Plan work, together",
  description:
    "A lightweight project management workspace: projects, task boards, and team roles.",
};

// Applies the saved (or system) theme before first paint to avoid a flash of
// the wrong colour scheme. Kept inline and tiny so it runs synchronously.
const themeScript = `(function(){try{var k='miniflow-theme',t=localStorage.getItem(k);if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.dataset.theme='dark';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hankenGrotesk.variable}`}>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
