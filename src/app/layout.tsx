import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "KONDO723 — AI 帳票定義生成",
  description: "Excel から ConMas 帳票定義を AI で自動生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* App Header */}
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tracking-widest text-gray-900 uppercase">
                KONDO723
              </span>
              <span className="h-4 w-px bg-gray-200" />
              <span className="hidden sm:inline text-xs text-gray-400 font-normal">
                AI 帳票定義生成
              </span>
            </div>
            <span className="text-[10px] font-medium text-gray-400 tracking-wide uppercase">
              Beta
            </span>
          </div>
        </header>
        {/* Main content */}
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
