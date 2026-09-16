import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Geist는 라틴 전용이라 한글은 시스템 기본폰트(맑은 고딕 등)로 대체돼
// 표시돼왔다 — 실제 화면 대부분이 한글인 ERP라 이 폰트가 사실상 안 쓰이고
// 있었던 셈이다. Pretendard를 자체 호스팅(next/font/local)해 한글까지
// 이 폰트로 통일한다.
const pretendard = localFont({
  variable: "--font-pretendard",
  src: [
    { path: "../fonts/pretendard/Pretendard-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Osungtech ERP",
  description: "Next.js + Supabase 기반 재고관리 ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
