import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Degree Pathway Suggester",
  description:
    "Pick your courses, major and minor by learning from students who came before you. Demo with synthetic data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="sticky top-0 z-40">
          <SyntheticBanner />
          <Header />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
            Degree Pathway Suggester · Hackathon demo. All students, alumni, courses, employers and outcomes are
            synthetic (fictional Ridgeview State University).
          </p>
        </footer>
      </body>
    </html>
  );
}
