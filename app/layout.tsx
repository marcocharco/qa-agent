import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnchorFish",
  description: "Your agent chats are your test suite.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
            <Link href="/" className="text-xl font-bold tracking-tight">AnchorFish<span className="text-accent">.</span></Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
