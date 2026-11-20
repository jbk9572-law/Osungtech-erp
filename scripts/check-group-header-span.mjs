// 매출/매입 표의 칸 수 일관성 검사 — 숨긴 칸(컬럼 설정·테마 칸)이 있어도 표가 어긋나지 않게 한다.
//  1) XXX_COLUMN_KEYS 개수 == 머리글 th(+sortableHeader) 개수 (순서 기준표가 실제 머리글과 같아야 colSpan 계산이 맞다)
//  2) "공급가액" 머리글이 KEYS의 supplyAmount 위치에 있다 (묶음 머리글 위치)
//  3) 합계 줄·이월 소계 줄의 칸 수 합(숨긴 칸 없을 때) == 머리글 칸 수  (남는 칸이 있으면 표 오른쪽에 빈 공간·가로 스크롤이 생긴다)
//  4) 2 초과 숫자 colSpan 직접 입력 금지 — spanOf(...)로 보이는 칸 수를 계산해야 한다
import fs from "node:fs";

const files = ["src/components/sales-grid/modern.tsx", "src/components/sales-grid/classic.tsx", "src/components/purchase-grid/modern.tsx", "src/components/purchase-grid/classic.tsx"];
const errors = [];

function rowCells(seg) {
  const cells = [];
  const re = /<td([^>]*?)(\/>|>)/g;
  let m;
  while ((m = re.exec(seg))) cells.push(m[1]);
  return cells;
}

function spanOfCell(attrs, keysLen) {
  const lit = attrs.match(/colSpan=\{(\d+)\}/);
  if (lit) return Number(lit[1]);
  const fn = attrs.match(/colSpan=\{spanOf\(\s*(\d+)\s*,\s*(\d+)\s*\)\}/);
  if (fn) return Number(fn[2]) - Number(fn[1]);
  if (/colSpan=\{spanOf\(\)\}/.test(attrs)) return keysLen;
  return 1;
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const keysMatch = src.match(/const (\w+_COLUMN_KEYS) = \[([^\]]*)\] as const;/);
  if (!keysMatch) {
    errors.push(`${f}: XXX_COLUMN_KEYS 배열을 찾지 못했습니다`);
    continue;
  }
  const keys = [...keysMatch[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const start = src.indexOf("<GridGroupHeaderRow");
  const end = src.indexOf("</thead>", start);
  const head = src.slice(start, end);
  const row = head.slice(head.indexOf("<tr>"));
  const cells = [...row.matchAll(/<th[\s>]|\{sortableHeader\(\s*"([^"]+)"/g)];
  if (cells.length !== keys.length) {
    errors.push(`${f}: 칸 키 ${keys.length}개인데 머리글 칸은 ${cells.length}개입니다`);
  }
  const idxSupply = cells.findIndex((c) => c[1] === "공급가액");
  if (idxSupply !== keys.indexOf("supplyAmount")) {
    errors.push(`${f}: "공급가액" 머리글은 ${idxSupply}번째인데 KEYS의 supplyAmount는 ${keys.indexOf("supplyAmount")}번째입니다`);
  }

  for (const [name, startText, backTr] of [
    ["이월 소계 줄", "전월 이월 소계", true],
    ["합계 줄(tfoot)", "<tfoot>", false],
  ]) {
    const i = src.indexOf(startText);
    if (i === -1) continue;
    const from = backTr ? src.lastIndexOf("<tr>", i) : i;
    const seg = src.slice(from, src.indexOf("</tr>", i));
    const total = rowCells(seg).reduce((sum, a) => sum + spanOfCell(a, keys.length), 0);
    if (total !== keys.length) errors.push(`${f}: ${name} 칸 합이 ${total}인데 표 칸은 ${keys.length}개입니다`);
  }

  for (const m of src.matchAll(/colSpan=\{(\d+)\}/g)) {
    if (Number(m[1]) > 2) {
      const line = src.slice(0, m.index).split("\n").length;
      errors.push(`${f}:${line} colSpan={${m[1]}} 직접 입력 금지 — spanOf(...)로 보이는 칸 수를 계산하세요`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("check-group-header-span: OK");
