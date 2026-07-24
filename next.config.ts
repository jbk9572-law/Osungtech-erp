import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오라클 클라우드 무료 서버(Docker)로 셀프호스팅할 때 필요한 최소
  // 실행 번들만 만든다. Vercel 배포에는 영향 없음(무시되는 옵션).
  // Netlify는 자체 Next.js 런타임이 .next 빌드 결과물을 그대로 읽어서
  // Netlify Functions로 감싸는 방식이라 standalone 번들이 필요 없고,
  // 오히려 런타임이 기대하는 파일 구조와 어긋날 수 있다. Netlify 빌드
  // 환경에는 자동으로 NETLIFY=true가 설정되므로, 그때만 이 옵션을 끈다
  // (오라클/Docker 셀프호스팅 빌드는 그대로 standalone 유지 — 영향 없음).
  output: process.env.NETLIFY ? undefined : "standalone",
  // PR 단계에서 이미 tsc --noEmit으로 타입을 검증하므로, 리소스가
  // 제한된 셀프호스팅 서버에서는 빌드 시간을 줄이기 위해 next build의
  // 자체 타입체크 단계를 생략한다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
