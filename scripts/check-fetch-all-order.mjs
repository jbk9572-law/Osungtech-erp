#!/usr/bin/env node
// fetchAllRows / fetchAllRowsIn 은 .range()로 1000건씩 끊어 받는다. 이때 .order()가 없으면 DB가 줄 순서를 보장하지 않아,
// 받는 도중 전표가 수정되거나 조인 결과 순서가 흔들리면 페이지 경계에서 행이 중복되거나 빠진다(합계가 조용히 틀린다).
// 그래서 호출 안에 .order( 가 있어야 한다 — 유일한 키(id 등)를 마지막 정렬로 넣는 것이 가장 안전하다.
// 이미 있던 곳은 scripts/fetch-all-order-baseline.json 에 파일별 개수로 묶어 두고, 늘리지 못하게 한다(줄이면 --write 로 낮춘다).
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const BASELINE = join(ROOT, "scripts/fetch-all-order-baseline.json");
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });

function callBodies(src) {
  const out = [];
  const re = /\bfetchAllRows(?:In)?\s*(?:<[^>(]*>)?\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      const c = src[i++];
      if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    out.push({ body: src.slice(re.lastIndex, i), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const found = {};
for (const f of walk(join(ROOT, "src"))) {
  if (f.endsWith("lib/fetch-all-rows.ts")) continue;
  const src = readFileSync(f, "utf8");
  const bad = callBodies(src).filter((c) => !/\.order\(/.test(c.body));
  if (bad.length) found[relative(ROOT, f)] = bad.map((b) => b.line);
}
const counts = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]));
if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`기준선 저장: ${Object.keys(counts).length}개 파일, ${Object.values(counts).reduce((a, b) => a + b, 0)}곳`);
  process.exit(0);
}
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const problems = [];
for (const [file, n] of Object.entries(counts)) {
  if (n > (base[file] ?? 0)) problems.push(`  - ${file}: 정렬 없는 fetchAllRows ${n}곳 (기준선 ${base[file] ?? 0}) — 줄 ${found[file].join(", ")}`);
}
if (problems.length) {
  console.error("정렬 없이 페이지를 넘기는 fetchAllRows/fetchAllRowsIn 이 늘었습니다 — .order(\"id\") 같은 유일한 정렬을 넣으세요:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`fetchAllRows 정렬 검사 통과 (기준선 ${Object.values(base).reduce((a, b) => a + b, 0)}곳 이내)`);
