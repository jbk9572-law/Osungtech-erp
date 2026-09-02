// 매출/매입 전표번호(doc_no) 직접 입력을 다루는 공통 로직 — 두 actions.ts가
// 각자 똑같은 코드를 갖고 있던 걸 하나로 뺐다.
export function parseDocNo(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// doc_no에는 유니크 제약이 걸려있어, 직접 입력한 번호가 이미 쓰이고
// 있으면 postgres 원문 에러("duplicate key value violates unique
// constraint...") 대신 알아볼 수 있는 안내로 바꿔준다.
export function docNoErrorMessage(
  error: { code?: string; message: string } | null,
  docNo: number | null
): string | null {
  if (error?.code === "23505" && error.message.includes("doc_no") && docNo != null) {
    return `이미 사용 중인 전표번호(No: ${docNo})입니다. 다른 번호를 입력하거나 비워서 자동 채번하세요.`;
  }
  return null;
}
