import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { PwaRegister } from "@/components/pwa-register";
import { ChunkErrorReload } from "@/components/chunk-error-reload";
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
  title: "ELVONIX",
  description: "Next.js + Supabase 기반 재고관리 ERP",
  // 홈화면에 추가해 standalone(PWA)으로 띄운 경우, Safari 브라우저 탭과
  // 달리 상태표시줄 영역은 이 meta 태그가 따로 있어야 webview가 그
  // 아래까지 그려진다(viewport-fit=cover만으로는 standalone 모드의
  // 상태표시줄 색까지는 안 바뀐다) — black-translucent라야 콘텐츠가
  // 상태표시줄 뒤까지 이어지고, 거기 위에 타이틀바(--erp-titlebar-h,
  // safe-area-inset-top 반영)가 얹혀서 남색이 꼭대기까지 꽉 차 보인다.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ELVONIX",
  },
};

export const viewport: Viewport = {
  themeColor: "#132944",
  // 기본값(contain)이면 아이폰 노치/다이나믹 아일랜드 영역은 그냥
  // 시스템 배경(흰색/검정)으로 남고 타이틀바 남색이 거기까지 안
  // 번진다 — cover로 바꾸고 실제 노치 높이만큼(env(safe-area-inset-top))
  // 타이틀바에 패딩을 더해줘야(erp-theme.css) 색이 화면 꼭대기까지
  // 꽉 찬다.
  viewportFit: "cover",
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
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <ChunkErrorReload />
        {children}
      </body>
    </html>
  );
}
