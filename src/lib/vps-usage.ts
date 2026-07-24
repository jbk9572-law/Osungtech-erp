import { statfsSync } from "node:fs";

export type VpsDiskUsage = { usedBytes: number; totalBytes: number };

// 앱이 실제로 이 서버(VPS) 위에서 돌고 있을 때만 의미가 있다. 서버리스
// 환경(Netlify/Vercel 등)에서는 statfsSync가 실패하지 않고 그 함수가 실행
// 중인 임시 컨테이너 자체의(전혀 무관한, 대부분 꽉 차 보이는) 파일시스템
// 값을 그대로 돌려줘서 실제 서버 디스크 용량인 것처럼 오해하게 만든다.
// try/catch 실패로는 걸러지지 않으므로 환경변수로 먼저 걸러야 하는데,
// NETLIFY 변수는 빌드 시점에만 설정되고 요청을 처리하는 함수 런타임에는
// 전달되지 않는다(넷리파이 공식 문서 확인). 런타임에도 항상 심어주는
// 예약 변수인 SITE_ID로 판별해야 실제로 걸러진다.
export function getVpsDiskUsage(): VpsDiskUsage | null {
  if (process.env.NETLIFY || process.env.SITE_ID) return null;

  try {
    const stats = statfsSync("/");
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    return { usedBytes: totalBytes - freeBytes, totalBytes };
  } catch {
    return null;
  }
}
