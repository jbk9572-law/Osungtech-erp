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
  // Server Action 요청 본문의 기본 상한은 1MB라, 영수증 사진을 여러 장
  // 첨부하면(장당 압축 후에도 150~300KB 안팎, 압축 실패 시 최대 8MB까지
  // 원본 그대로 전송됨) 금방 넘겨서 "서버 오류"로 요청 자체가 거부된다.
  // 넉넉하게 올려준다.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // 기본 보안 헤더 — 전엔 Next.js/Caddy 어느 쪽에도 설정돼 있지 않았다
  // (헌법검사 보안 점검으로 발견). CSP는 이 앱의 인라인 스타일/스크립트
  // 사용 범위를 더 조사해야 안전하게 넣을 수 있어 일단 보류하고, 깨질
  // 위험 없이 바로 넣을 수 있는 항목만 우선 추가한다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 다른 사이트가 이 앱을 <iframe>에 몰래 넣어 클릭재킹하는 걸 막는다.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // 브라우저가 응답의 Content-Type을 무시하고 "추측"해서 실행하는
          // MIME 스니핑을 막는다(예: 업로드된 파일을 스크립트로 오인 실행).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 다른 도메인으로 이동할 때 이 사이트의 전체 URL(쿼리스트링 등)이
          // 그대로 Referer로 새 나가지 않게 한다.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 이 앱이 쓰지 않는 민감한 브라우저 기능(카메라/마이크/위치)을
          // 명시적으로 꺼서, 그 기능을 쓰는 악성 삽입 코드가 있어도 막는다.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
