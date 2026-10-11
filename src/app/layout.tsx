import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JetYield AI: yield optimization for private aircraft",
  description:
    "See your jet's true cost per hour, sell the empty legs you're already flying, and get AI recommendations that lower ownership cost.",
  openGraph: {
    title: "JetYield AI",
    description: "AI-native yield optimization for private aircraft owners and operators.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#06080c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
