// 서버 전용 시크릿(NEXT_PUBLIC_ 접두사가 없는 값)을 읽는 공용 함수.
// 상시 가동 Node 서버(Docker, .env.production)에서는 process.env에
// 항상 채워져 있어 이걸로 충분하다. (예전 Cloudflare Workers 배포
// 시절엔 요청 시점 바인딩에서 따로 읽어야 하는 경우가 있어 폴백
// 경로가 있었는데, 지금은 필요 없어 제거했다.)
export function getServerEnv(name: string): string | undefined {
  return process.env[name];
}
