import { statfsSync } from "node:fs";

export type VpsDiskUsage = { usedBytes: number; totalBytes: number };

// 앱이 실제로 이 서버(VPS) 위에서 돌고 있을 때만 의미가 있다. Vercel 같은
// 서버리스 환경에서는 컨테이너마다 파일시스템이 다르게 잡혀서 이 값이
// 실제 서버 디스크 용량과 무관해질 수 있으므로, 실패 시 그냥 null을
// 반환해 위젯을 숨긴다.
export function getVpsDiskUsage(): VpsDiskUsage | null {
  try {
    const stats = statfsSync("/");
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    return { usedBytes: totalBytes - freeBytes, totalBytes };
  } catch {
    return null;
  }
}
