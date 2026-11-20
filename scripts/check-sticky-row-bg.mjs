#!/usr/bin/env node
// 목록 표의 고정(sticky) 칸이 행 색과 따로 노는 버그를 막는 검사.
//
// 배경: 고정 칸은 옆으로 스크롤되는 칸을 가려야 해서 불투명 배경을 갖는다. 예전엔 인라인 background가 항상 흰색(패널색)이라
// 행에 마우스를 올리거나 눌러도(줄무늬·hover·선택·펼침) 고정 칸(체크박스·번호·날짜)만 흰색으로 남았고, 칸 폭이 줄어들면 두 고정 칸 사이에
// 행 색이 가는 띠로 비쳤다(매입/매출 목록, 사용자 지적).
//
// 지금 구조: stickyCellStyle(grid-sticky.ts)이 background를 var(--erp-row-bg, ...)로 두고, erp-theme.css의 "행 배경을 바꾸는 규칙"이 같은 값을
// --erp-row-bg로도 내보낸다. 그래서 새 행 상태를 추가하면서 변수를 빼먹으면 그 상태에서만 고정 칸이 흰색으로 남는다 — 아래 두 가지를 검사한다.
//   1) grid-sticky.ts의 stickyCellStyle 배경이 --erp-row-bg를 읽고, 폭을 minWidth로도 못박는지
//   2) erp-theme.css에서 ".erp-grid tbody tr…" 규칙이 background를 바꾸면 --erp-row-bg도 같이 바꾸는지(td를 직접 칠하는 이월·오늘·예약 규칙과 아코디언 행은 제외)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const sticky = readFileSync(path.join(root, "src/lib/grid-sticky.ts"), "utf8");
const cellFn = sticky.slice(sticky.indexOf("export function stickyCellStyle"));
if (!/var\(--erp-row-bg/.test(cellFn.split("\n}")[0])) problems.push("src/lib/grid-sticky.ts: stickyCellStyle의 background가 var(--erp-row-bg, …)가 아닙니다.");
for (const fn of ["stickyHeaderStyle", "stickyCellStyle"]) {
  const body = sticky.slice(sticky.indexOf(`export function ${fn}`)).split("\n}")[0];
  if (!/minWidth:\s*width/.test(body)) problems.push(`src/lib/grid-sticky.ts: ${fn}가 minWidth를 못박지 않습니다(칸이 줄면 고정 칸 사이에 틈이 생깁니다).`);
}

const css = readFileSync(path.join(root, "src/app/erp-theme.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let checked = 0;
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim();
  const body = m[2];
  if (!/\.erp-grid\s+tbody\s+tr\b/.test(selector)) continue;
  if (/>\s*td|\btd\b/.test(selector)) continue; // td를 직접 칠하는 규칙(이월·오늘·예약 등)은 !important로 고정 칸까지 덮는다
  if (/accordion/.test(selector)) continue; // 펼침 행 안의 표는 고정 칸이 없다
  if (!/(^|[;\s])background\s*:/.test(body)) continue;
  checked += 1;
  if (!/--erp-row-bg\s*:/.test(body)) problems.push(`src/app/erp-theme.css: "${selector.replace(/\s+/g, " ")}" 규칙이 행 배경을 바꾸지만 --erp-row-bg는 바꾸지 않습니다(고정 칸이 혼자 흰색으로 남습니다).`);
}

if (problems.length) {
  console.error("고정 칸 행 색 검사 실패:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`고정 칸 행 색 검사 통과 (행 배경 규칙 ${checked}개 모두 --erp-row-bg 동반)`);
