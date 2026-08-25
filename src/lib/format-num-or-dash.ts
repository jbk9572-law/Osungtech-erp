// 판매가/매입가처럼 "0으로 등록해두는 경우가 실질적으로 없는" 숫자 필드는
// 0이 그대로 찍히면 진짜 0원인 것과 "아직 안 정했다"는 뜻이 구분이 안
// 된다. 0(또는 null/undefined)이면 "-"로 보여준다 — 수량처럼 0이 실제로
//의미 있는 값인 필드에는 쓰지 않는다.
export function formatNumOrDash(n: number | string | null | undefined): string {
  const value = typeof n === "string" ? Number(n) : n;
  return value ? value.toLocaleString() : "-";
}
