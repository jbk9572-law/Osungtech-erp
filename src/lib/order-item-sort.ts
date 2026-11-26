// 목록 화면은 품목을 전표 구분 없이 한 줄씩 받아 전표별로 묶는다. 전표(그룹) 순서는 받은 그대로 두고,
// 한 전표 안의 품목만 "입력한 순서"(line_no)로 바로잡는다 — 대표 품목("○○ 외 N건")도 이 첫 줄이 된다.
export function orderItemsByLine<T extends { line_no?: number | null }>(rows: T[], orderIdOf: (row: T) => string | null | undefined): T[] {
  const groups = new Map<string, T[]>();
  const loose: T[] = [];
  for (const row of rows) {
    const id = orderIdOf(row);
    if (!id) {
      loose.push(row);
      continue;
    }
    const g = groups.get(id);
    if (g) g.push(row);
    else groups.set(id, [row]);
  }
  const out: T[] = [];
  for (const g of groups.values()) out.push(...g.map((r, i) => [r, i] as const).sort((a, b) => (a[0].line_no ?? 1e9) - (b[0].line_no ?? 1e9) || a[1] - b[1]).map(([r]) => r));
  return out.concat(loose);
}
