import { Inter, Outfit } from "next/font/google";
import React from "react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Tambayan",
  description: "A community chat platform built with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} font-sans antialiased`}
        suppressHydrationWarning={true}
      >
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950">
          <main className="flex-1 relative overflow-hidden">
            {children}
          </main>
          <footer className="shrink-0 w-full py-2.5 text-center text-[10px] text-zinc-600 bg-zinc-950 border-t border-white/5">
            © 2026 Digital Tambayan by General Malit - development (beta 0.10.1)
          </footer>
        </div>
      </body>
    </html>
  );
}
