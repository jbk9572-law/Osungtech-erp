// Next.js는 프로덕션 빌드에서 서버 렌더링 중 예외가 나면 클라이언트로
// 내려주는 digest뿐 아니라 서버 자체 로그(Cloudflare Workers Logs 포함)
// 에서도 실제 에러 메시지를 지운다 — 보안상 의도된 동작이다. 그 결과
// "일시적인 오류로 화면을 불러오지 못했습니다"가 재현될 때 Cloudflare
// Workers Logs에 남는 건 스택트레이스뿐이고("Promise.all (index N)"),
// 정작 무엇이 왜 실패했는지는 어떤 방법으로도 확인할 수 없었다.
//
// onRequestError는 Next.js가 그 메시지를 지우기 전에 호출해주는 공식
// 훅이다 — 여기서 console.error로 찍은 내용은 마스킹되지 않은 진짜
// 에러 메시지를 포함해서 Cloudflare Workers Logs에 그대로 남는다.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  console.error(
    JSON.stringify({
      tag: "onRequestError",
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  );
}
