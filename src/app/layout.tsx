import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SelectionChrome } from "@/components/selection-chrome";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LearnLoop",
  description: "A personalized feed of ideas worth your attention.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} min-h-screen font-sans`}>
        {/* early script for no-FOUC theme restore, default light mocha */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const s = localStorage.getItem('theme'); const r = document.documentElement; if (s === 'dark') r.classList.add('dark'); else r.classList.remove('dark'); } catch(e){} })();`,
          }}
        />
        <SelectionChrome />
        {children}
      </body>
    </html>
  );
}