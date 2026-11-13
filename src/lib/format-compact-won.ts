// 달력 칸처럼 좁은 자리에서 금액을 짧게 보여준다 — 1억 이상 "1.2억", 1만 이상 "324만", 그 아래는 그대로.
// 정확한 금액은 칸을 눌러 열리는 오른쪽 리포트에서 본다. 반품 등 음수는 부호를 유지한다.
export function formatCompactWon(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 100_000_000) return `${sign}${trim(a / 100_000_000)}억`;
  if (a >= 10_000) return `${sign}${Math.round(a / 10_000).toLocaleString("ko-KR")}만`;
  return `${sign}${a.toLocaleString("ko-KR")}`;
}

function trim(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}
