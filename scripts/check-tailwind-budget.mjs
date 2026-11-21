#!/usr/bin/env node
// ERP 화면 코드에 Tailwind 유틸리티(mb-3, text-xs, flex, gap-2 …)를 새로 쓰지 못하게 막는다 — 간격·글자·배치는 erp-u-* 유틸 클래스/컴포넌트로 통일(개발헌법 3번).
// 이미 있는 것은 파일별 기준선(tailwind-budget.json)에 적어 두고 늘리지 못하게 한다. 정리해서 줄이면 기준선도 낮춘다(--write).
// 제외: 인쇄 문서(견적서·명세표·급여명세서·invoice·print 페이지)·로그인/가입·고객 포털·플랫폼 관리자·모조지 모듈은 자기 완결형 화면이라 Tailwind를 그대로 쓴다. classic.tsx(클래식 동결본)도 뺀다.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "src");
const BASE = path.join(here, "tailwind-budget.json");
const EXCLUDE = ["quotation-doc", "delivery-note-doc", "payslip-doc", "app/login", "app/signup", "app/privacy", "app/terms", "modules/paper-calc", "/invoice/", "/print/", "app/portal", "platform-admin", "tax-invoice"];
const TW = /^(?:-?m[trblxy]?-\d+(?:\.\d+)?|-?p[trblxy]?-\d+(?:\.\d+)?|gap(?:-[xy])?-\d+(?:\.\d+)?|space-[xy]-\d+|text-(?:xs|sm|base|lg|xl|2xl)|font-(?:bold|semibold|medium|normal)|flex|inline-flex|grid|block|hidden|items-(?:center|start|end)|justify-(?:between|center|end)|flex-(?:wrap|col|1|none)|w-full|h-full|min-w-0|truncate|text-(?:left|right|center)|overflow-(?:hidden|auto|x-auto)|rounded(?:-\w+)?|border(?:-\w+)?|cursor-pointer|whitespace-nowrap|relative|absolute)$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") && !full.includes(".test.") && e.name !== "classic.tsx") out.push(full);
  }
  return out;
}
const current = {};
for (const f of walk(root)) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  if (EXCLUDE.some((x) => ("/" + rel).includes(x))) continue;
  const text = readFileSync(f, "utf8");
  let n = 0;
  for (const m of text.matchAll(/className="([^"{}]*)"/g)) n += m[1].split(/\s+/).filter((c) => TW.test(c)).length;
  if (n) current[rel] = n;
}
if (process.argv.includes("--write")) {
  writeFileSync(BASE, JSON.stringify(current, null, 2) + "\n");
  console.log("Tailwind 기준선 기록:", Object.keys(current).length, "개 파일,", Object.values(current).reduce((a, b) => a + b, 0), "개");
  process.exit(0);
}
const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, "utf8")) : {};
const problems = [], shrunk = [];
for (const [f, n] of Object.entries(current)) {
  const allowed = base[f] ?? 0;
  if (n > allowed) problems.push(`${f}: ${n}개 (기준선 ${allowed}) — Tailwind 대신 erp-u-* 유틸 클래스/공용 컴포넌트를 쓰세요`);
  else if (n < allowed) shrunk.push(`${f}: ${allowed} → ${n}`);
}
for (const f of Object.keys(base)) if (!(f in current)) shrunk.push(`${f}: 기준선 항목 삭제`);
if (problems.length) {
  console.error("Tailwind 사용 검사 실패:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
const total = Object.values(current).reduce((a, b) => a + b, 0);
console.log(`Tailwind 사용 검사 통과 (ERP 화면 ${Object.keys(current).length}개 파일, ${total}개 — 늘지 않음)`);
if (shrunk.length) console.log(`  참고: 줄었습니다 — node scripts/check-tailwind-budget.mjs --write 로 기준선을 낮추세요(${shrunk.length}곳)`);
