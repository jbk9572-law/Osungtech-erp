// FormData에서 숫자 필드를 읽을 때 공통으로 쓰는 안전 파서. Number(raw)는
// 잘못된 값(문자, 빈 문자열 등)이 들어오면 NaN을 반환하는데, 그대로 DB에
// 저장하면 JSON 직렬화 과정에서 NaN이 null로 조용히 바뀌어버려 사용자가
// 오타를 냈다는 사실을 알아챌 방법이 없다. fallback으로 명시적으로 되돌린다.
export function numberOrDefault(raw: FormDataEntryValue | null, fallback: number): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

export function numberOrNull(raw: FormDataEntryValue | null): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

// 금액·수량 상한. 이 값을 넘거나 NaN/Infinity 이면 "비정상 입력"으로 본다(order-items-input.ts 의 상한과 같은 기준).
export const MAX_SANE_QUANTITY = 1_000_000_000;
export const MAX_SANE_AMOUNT = 1_000_000_000_000;

/** 유한한 숫자이고 절댓값이 상한 이하인가. (Infinity, NaN, 1e30 같은 값을 거른다) */
export function isSaneNumber(value: unknown, max: number = MAX_SANE_AMOUNT): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max;
}
