import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오라클 클라우드 무료 서버(Docker)로 셀프호스팅할 때 필요한 최소
  // 실행 번들만 만든다. Vercel 배포에는 영향 없음(무시되는 옵션).
  output: "standalone",
  // PR 단계에서 이미 tsc --noEmit으로 타입을 검증하므로, 리소스가
  // 제한된 셀프호스팅 서버에서는 빌드 시간을 줄이기 위해 next build의
  // 자체 타입체크 단계를 생략한다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
