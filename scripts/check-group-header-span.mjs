// 묶음 머리글(GridGroupHeaderRow)의 칸 수(before/span/after)가 실제 머리글 줄(th) 개수·위치와 맞는지 검사한다.
// 숨김 칸(컬럼 설정)도 DOM에 남으므로 th/sortableHeader 개수가 곧 칸 수다. 열을 추가/삭제하고 이 숫자를 안 고치면 실패한다.
import fs from "node:fs";

const files = ["src/components/sales-grid-table.tsx", "src/components/purchase-grid-table.tsx"];
const errors = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const m = src.match(/<GridGroupHeaderRow\s+before=\{(\d+)\}\s+span=\{(\d+)\}\s+after=\{(\d+)\}\s+label="([^"]+)"/);
  if (!m) {
    errors.push(`${f}: <GridGroupHeaderRow before/span/after label /> 를 찾지 못했습니다`);
    continue;
  }
  const [before, span, after] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = src.indexOf("<GridGroupHeaderRow");
  const end = src.indexOf("</thead>", start);
  const head = src.slice(start, end);
  const row = head.slice(head.indexOf("<tr>"));
  const cells = [...row.matchAll(/<th[\s>]|\{sortableHeader\(\s*"([^"]+)"/g)];
  const labels = [...row.matchAll(/<th[^>]*>([^<{]*)<\/th>|\{sortableHeader\(\s*"([^"]+)"/g)].map((x) => x[1] ?? x[2] ?? "");
  const total = cells.length;
  if (before + span + after !== total) {
    errors.push(`${f}: 묶음 머리글 칸 수 ${before}+${span}+${after}=${before + span + after} 인데 머리글 칸은 ${total}개입니다`);
  }
  // 묶음이 공급가액·세액 두 칸 위에 정확히 얹히는지(첫 칸 이름으로 확인)
  const idxSupply = cells.findIndex((c) => c[1] === "공급가액");
  if (idxSupply !== before) {
    errors.push(`${f}: "공급가액" 칸이 ${idxSupply}번째인데 묶음 머리글 앞 칸 수(before)는 ${before}입니다`);
  }
  void labels;
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("check-group-header-span: OK");
