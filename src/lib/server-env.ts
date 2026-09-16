import { getCloudflareContext } from "@opennextjs/cloudflare";

// 서버 전용 시크릿(NEXT_PUBLIC_ 접두사가 없는 값)을 읽는 공용 함수.
// 넷리파이/자체호스팅에서는 process.env에 항상 채워져 있어 그걸로 충분하지만,
// 클라우드플레어(Workers) 배포에서는 NEXT_PUBLIC_* 값과 달리(빌드 시점에
// 코드에 그대로 박혀서 항상 됨) 서버 전용 값이 요청 시점의 process.env에
// 안 채워지는 경우가 있다 — 그때는 Workers 바인딩(getCloudflareContext().env)
// 에서 대신 읽는다. 클라우드플레어가 아닌 환경에서는 그 호출 자체가 실패하니
// 그냥 무시하고 undefined로 취급한다.
export function getServerEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  try {
    const { env } = getCloudflareContext();
    return (env as Record<string, string | undefined>)[name];
  } catch {
    return undefined;
  }
}
