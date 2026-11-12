#!/usr/bin/env node
// 선택 모듈(현재: 모조지 계산)은 src/modules/<이름>/ 안에 모여 있어야 하고,
// 모듈 밖(핵심 화면/서버 액션)이 모듈 내부 파일을 마음대로 import하지 못하게
// 막는다 — 그래야 "모듈을 켠 회사에서만 동작하는 선택 기능"이라는 경계가
// 다시 허물어지지 않는다(예전에는 매출/매입 폼이 모조지 계산 코드를 직접
// 100곳 가까이 알고 있었다).
//
// 공개 입구(ENTRIES) 밖의 내부 파일을 직접 부르는 핵심 파일은 분리 작업 도중이라
// ALLOWLIST에 "파일: 허용 import 개수 상한"으로 적어둔다. 분리가 진행돼
// 연결점이 줄면 숫자를 낮추고, 0이 되면 항목을 지운다. 목록에 없는 파일이
// 새로 모듈을 import하거나 상한을 넘기면 실패한다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const MODULES = ["paper-calc"];
// 핵심 코드가 써도 되는 모듈 공개 입구(모듈 안의 파일명, 확장자 제외).
const ENTRIES = ["order-form", "order-actions", "actions", "public", "ui", "todo-form"];
// 모듈 자신의 화면 경로(라우트)는 모듈의 일부로 본다.
const OWN_ROUTE_PREFIXES = { "paper-calc": ["app/(dashboard)/paper-calc/", "app/(dashboard)/@modal/(.)paper-calc/"] };

const ALLOWLIST = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "module-boundary-allowlist.json"), "utf8"));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const counts = new Map();
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const src = readFileSync(file, "utf8");
  for (const mod of MODULES) {
    if (rel.startsWith(`modules/${mod}/`)) continue;
    if ((OWN_ROUTE_PREFIXES[mod] ?? []).some((p) => rel.startsWith(p))) continue;
    const all = src.match(new RegExp(`["']@/modules/${mod}/[^"']*`, "g")) ?? [];
    // 공개 입구(ENTRIES)를 통한 import는 허용하고, 내부 파일 직접 import만 센다.
    const n = all.filter((m) => !ENTRIES.some((e) => m.slice(1) === `@/modules/${mod}/${e}`)).length;
    if (n > 0) counts.set(`${mod}|${rel}`, n);
  }
}

const problems = [];
for (const [key, n] of counts) {
  const limit = ALLOWLIST[key] ?? 0;
  if (n > limit) problems.push(`${key.split("|")[1]}: 모듈(${key.split("|")[0]}) import ${n}개 (허용 ${limit}개)`);
}
for (const [key, limit] of Object.entries(ALLOWLIST)) {
  const n = counts.get(key) ?? 0;
  if (n < limit) problems.push(`${key.split("|")[1]}: 허용 상한을 ${n}으로 낮춰라(현재 ${limit}) — module-boundary-allowlist.json 갱신`);
}
if (problems.length) {
  console.error("모듈 경계 검사 실패:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`모듈 경계 검사 통과 (핵심 파일 ${counts.size}개가 모듈 내부 파일을 직접 import(허용 목록과 일치) — 나머지는 공개 입구만 사용)`);
