// Supabase에서 .update()/.delete() 뒤에 .select()를 붙이면 실제로 바뀐
// 행만 돌려준다. RLS가 막으면(본인이 등록한 게 아니거나 관리자가 아님)
// error 없이 조용히 0건으로 끝나므로, error 확인만으로는 부족하고 이 행
// 수까지 봐야 "진짜 성공"을 알 수 있다 — 이 두 단계 확인이 actions.ts
// 전체에 거의 똑같은 모양으로 15곳 복붙돼 있던 걸 하나로 모았다.
type MutationResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export function wasRowMutated<T>(result: MutationResult<T>): boolean {
  return !result.error && !!result.data && result.data.length > 0;
}

// 가장 흔한 형태: 실패하면 서버 액션의 FormState({ error }) 문자열을 바로
// 만들어 반환한다. onError/onForbidden에 같은 문자열을 주면(또는 messages를
// 문자열 하나로 주면) 기존에 "error든 0건이든 메시지 하나로 합쳐서
// 안내하던" 곳도 그대로 동작한다.
export function requireMutatedRow<T>(
  result: MutationResult<T>,
  messages: string | { onError: string; onForbidden: string }
): { error: string } | null {
  const { onError, onForbidden } =
    typeof messages === "string" ? { onError: messages, onForbidden: messages } : messages;
  if (result.error) {
    return { error: onError === onForbidden ? onError : `${onError}: ${result.error.message}` };
  }
  if (!result.data || result.data.length === 0) {
    return { error: onForbidden };
  }
  return null;
}
