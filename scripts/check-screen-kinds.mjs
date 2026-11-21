#!/usr/bin/env node
// 화면 종류(A 업무 목록 / B 소통형 3분할 / C 입력 모달) 규칙을 지키는지 검사한다 — 개발헌법 12번.
//
// 목록에서 하나를 골라 상세를 보는 방식이 화면마다 달랐던 것("2분할·3분할·오른쪽 좁은 패널·아코디언·표 끝 상세 →")을 막기 위해,
// "옛 방식"을 쓰는 파일을 기준선(screen-kinds-baseline.json)에 적어 두고 새로 늘어나는 것만 실패로 본다. 화면을 A/B/C로 옮기면
// 그 파일이 기준선에서 빠지므로 `node scripts/check-screen-kinds.mjs --write` 로 기준선을 줄인다(늘리기는 사람이 직접 JSON을 고쳐야 한다).
//
// 검사 4가지(각각 "옛 방식을 쓰는 파일 목록"):
//   split2        : 2분할(erp-split-shell) — 업무 목록은 A(표+오른쪽 패널), 소통형은 B(3분할)로
//   accordion     : 행 아래 펼치는 아코디언 상세(OrderDetailPanel) — A는 오른쪽 패널을 쓴다
//   trailingLink  : 표 끝 "상세 →"/"수정 →" 칸 — 행 클릭과 패널 버튼이 그 역할
//   split3NoFilter: 3분할(erp-split3-shell)인데 왼쪽 필터 열(erp-split3-filter)이 없는 것 — B는 필터 열이 있다
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const baselinePath = path.join(root, "scripts", "screen-kinds-baseline.json");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}

// 3분할 화면은 필터 열을 자식 목록 컴포넌트(@/components/...)에서 그리기도 하므로, 가져오는 컴포넌트 안에 필터 열이 있으면 인정한다.
function hasFilterColumn(code) {
  if (/erp-split3-filter|<SplitFilterColumn\b/.test(code)) return true;
  for (const m of code.matchAll(/from\s+"@\/([^"]+)"/g)) {
    for (const ext of [".tsx", "/index.tsx"]) {
      const f = path.join(src, m[1] + ext);
      if (existsSync(f) && /<SplitFilterColumn\b/.test(readFileSync(f, "utf8"))) return true;
    }
  }
  return false;
}

// classic.tsx = 클래식 테마 전용 동결본 — 모던과 코드를 공유하지 않고 그대로 둔다. 옛 방식 검사에서 빼되, 목록(classicFrozen)은 기준선으로 늘지 못하게 막는다.
const current = { split2: [], accordion: [], trailingLink: [], split3NoFilter: [], classicFrozen: [], rawTitle: [] };
for (const file of walk(src)) {
  const rel = path.relative(src, file).split(path.sep).join("/");
  const text = readFileSync(file, "utf8");
  // 주석 안의 설명은 제외하고 본다
  if (/(^|\/)classic\.tsx$/.test(rel)) {
    current.classicFrozen.push(rel);
    continue;
  }
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/erp-split-shell/.test(code)) current.split2.push(rel);
  if (/<OrderDetailPanel\b/.test(code)) current.accordion.push(rel);
  if (/(상세|수정) →/.test(code)) current.trailingLink.push(rel);
  if (/erp-split3-shell/.test(code) && !hasFilterColumn(code)) current.split3NoFilter.push(rel);
  // 제목줄은 공용 ListTitleBar/ListPageHeader로 — <h1 className="erp-h1">를 손으로 다시 짜지 않는다.
  if (/className="erp-h1"/.test(code) && !/components\/erp\/page-header\.tsx$/.test(rel)) current.rawTitle.push(rel);
}
for (const k of Object.keys(current)) current[k].sort();

if (process.argv.includes("--write")) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + "\n");
  console.log("기준선을 현재 상태로 기록했습니다:", Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v.length])));
  process.exit(0);
}

const base = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : { split2: [], accordion: [], trailingLink: [], split3NoFilter: [], classicFrozen: [], rawTitle: [] };
const HINT = {
  split2: "2분할(erp-split-shell)을 새로 쓰지 마세요 — 업무 목록은 A(표 + 오른쪽 상세 패널), 소통형은 B(3분할 + 필터 열)로 만드세요.",
  accordion: "아코디언 상세(OrderDetailPanel)를 새로 쓰지 마세요 — A는 오른쪽 상세 패널(OrderSidePanel/DetailSideShell)을 씁니다.",
  trailingLink: "표 끝 \"상세 →\"/\"수정 →\" 칸을 새로 만들지 마세요 — 행 클릭 = 패널, 패널의 [상세 보기]/[수정] 버튼이 그 역할입니다.",
  rawTitle: "제목줄을 손으로 짜지 마세요 — ListTitleBar(제목+툴바 한 줄) 또는 ListPageHeader를 쓰세요(개발헌법 3번).",
  classicFrozen: "classic.tsx(클래식 동결본)를 새로 만들지 마세요 — 새 화면은 A/B/C로 만들고 테마 분기가 필요하면 먼저 상의하세요.",
  split3NoFilter: "3분할(erp-split3-shell)에는 왼쪽 필터 열(erp-split3-filter)이 있어야 합니다(개발헌법 12번 B형).",
};
const problems = [];
const stale = [];
for (const k of Object.keys(current)) {
  const allowed = new Set(base[k] ?? []);
  for (const f of current[k]) if (!allowed.has(f)) problems.push(`[${k}] ${f}\n      → ${HINT[k]}`);
  for (const f of base[k] ?? []) if (!current[k].includes(f)) stale.push(`[${k}] ${f}`);
}
if (problems.length) {
  console.error("화면 종류 규칙 검사 실패 — 옛 방식이 새로 늘었습니다:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
const total = Object.values(current).reduce((n, v) => n + v.length, 0);
console.log(`화면 종류 규칙 검사 통과 (남은 옛 방식 ${total}곳 — ${Object.entries(current).map(([k, v]) => `${k} ${v.length}`).join(", ")})`);
if (stale.length) console.log(`  참고: 기준선에서 뺄 수 있는 곳 ${stale.length}곳(이미 옮겨짐) — node scripts/check-screen-kinds.mjs --write 로 줄이세요:\n    ${stale.join("\n    ")}`);
