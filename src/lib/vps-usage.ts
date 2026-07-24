import { statfsSync } from "node:fs";

export type VpsDiskUsage = { usedBytes: number; totalBytes: number };

// 앱이 실제로 이 서버(VPS) 위에서 돌고 있을 때만 의미가 있다. 서버리스
// 환경(Netlify/Vercel 등)에서는 statfsSync가 실패하지 않고 그 함수가 실행
// 중인 임시 컨테이너 자체의(전혀 무관한, 대부분 꽉 차 보이는) 파일시스템
// 값을 그대로 돌려줘서 실제 서버 디스크 용량인 것처럼 오해하게 만든다.
// try/catch 실패로는 걸러지지 않으므로, Netlify 빌드 시 자동으로 설정되는
// NETLIFY 환경변수로 먼저 걸러서 위젯 자체를 숨긴다.
export function getVpsDiskUsage(): VpsDiskUsage | null {
  if (process.env.NETLIFY) return null;

  try {
    const stats = statfsSync("/");
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    return { usedBytes: totalBytes - freeBytes, totalBytes };
  } catch {
    return null;
  }
}
