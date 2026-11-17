#!/usr/bin/env node
// 같은 CSS 선택자를 두 군데 이상에서 정의하면서 "같은 속성"을 서로 다르게 쓰는 경우를 찾는다.
// 실제 사고: .erp-seg(전환 버튼)가 한 곳은 "바깥 테두리", 다른 곳은 "버튼마다 테두리"로 따로 정의돼 겹쳐서 테두리가 이중으로 보였다.
// 파일이 7천 줄이라 사람이 눈으로는 못 잡는다 — 같은 선택자·같은 조건(@media)에서 같은 속성을 두 번 쓰면 뒤의 것이 앞의 것을 조용히 덮어써서
// "고쳤는데 안 바뀐다 / 어느 쪽이 적용되는지 모른다"가 된다.
//
// 검사 방법: postcss로 파싱해 (조건(@media 등) + 선택자) 별로 규칙을 모으고, 2번 이상 나오면서 서로 겹치는 속성이 있으면 위반으로 본다.
// 이미 있는 것은 scripts/css-duplicate-baseline.json에 고정(래칫)해서 새로 늘어나는 것만 막고, 정리하면 기준선도 같이 줄인다:
//   node scripts/check-duplicate-css-rules.mjs --write

import postcss from "postcss";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["src/app/erp-theme.css", "src/app/globals.css"];
const BASELINE = path.join(root, "scripts/css-duplicate-baseline.json");

function contextOf(node) {
  const parts = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule") parts.unshift(`@${p.name} ${p.params}`);
  }
  return parts.join(" > ");
}

const found = new Map(); // key -> { places: [{file,line,props:Set}] }
for (const rel of FILES) {
  const css = readFileSync(path.join(root, rel), "utf8");
  postcss.parse(css, { from: rel }).walkRules((rule) => {
    // @keyframes 안의 from/to/% 는 선택자가 아니라 단계라서 제외
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const props = new Set();
    rule.each((n) => {
      if (n.type === "decl" && !n.prop.startsWith("--")) props.add(n.prop);
    });
    if (!props.size) return;
    for (const sel of rule.selectors ?? []) {
      const selector = sel.replace(/\s+/g, " ").trim();
      const key = `${contextOf(rule)} || ${selector}`;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push({ file: rel, line: rule.source?.start?.line ?? 0, props });
    }
  });
}

const violations = [];
for (const [key, places] of found) {
  if (places.length < 2) continue;
  // 겹치는 속성이 있어야 "서로 덮어쓰는" 중복이다(속성이 서로 안 겹치면 나눠 쓴 것일 뿐)
  const seen = new Map();
  const overlap = new Set();
  for (const p of places) for (const prop of p.props) {
    seen.set(prop, (seen.get(prop) ?? 0) + 1);
    if (seen.get(prop) > 1) overlap.add(prop);
  }
  if (overlap.size) violations.push({ key, lines: places.map((p) => `${p.file}:${p.line}`), props: [...overlap] });
}

const keys = violations.map((v) => v.key).sort();

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, JSON.stringify(keys, null, 2) + "\n");
  console.log(`기준선 저장: 중복 정의 ${keys.length}건`);
  process.exit(0);
}

const baseline = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : []);
const fresh = violations.filter((v) => !baseline.has(v.key));
const fixed = [...baseline].filter((k) => !keys.includes(k));

if (fresh.length) {
  console.error("CSS 중복 정의 검사 실패 — 같은 선택자를 같은 조건에서 두 번 정의하면서 같은 속성을 쓰고 있습니다:");
  for (const v of fresh) console.error(`  - ${v.key}\n      위치: ${v.lines.join(", ")}\n      겹치는 속성: ${v.props.join(", ")}`);
  console.error("\n한 곳으로 합치세요(뒤의 규칙이 앞의 규칙을 조용히 덮어써서 화면이 의도와 다르게 나옵니다).");
  process.exit(1);
}
if (fixed.length) {
  console.log(`정리됨 ${fixed.length}건 — 기준선을 줄이세요: node scripts/check-duplicate-css-rules.mjs --write`);
}
console.log(`CSS 중복 정의: 기준선 ${baseline.size}건 이내(현재 ${keys.length}건)`);
