import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오라클 클라우드 무료 서버(Docker)로 셀프호스팅할 때 필요한 최소
  // 실행 번들만 만든다. Vercel 배포에는 영향 없음(무시되는 옵션).
  output: "standalone",
};

export default nextConfig;
