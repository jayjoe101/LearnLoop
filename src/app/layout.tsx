import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatyCursor } from "@/components/floaty-cursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightScroll — Your Personalized Wisdom Feed",
  description:
    "A doomscroll-style learning feed powered by Grok. Personalized topics, infinite insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}
      >
        {/* Inline script runs synchronously very early to set .dark or not before React UI paints (default light) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const saved = localStorage.getItem('theme');
                const root = document.documentElement;
                if (saved === 'dark') {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }
              } catch (e) {}
            })();`,
          }}
        />
        <FloatyCursor />
        {children}
      </body>
    </html>
  );
}