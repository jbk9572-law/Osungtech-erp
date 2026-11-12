#!/usr/bin/env node
// 한 파일이 너무 커지면(수천 줄) 읽기·수정·검토가 어려워지고 같은 실수가 숨는다. 새 파일은 MAX_LINES를 넘지
// 못하고, 이미 큰 파일은 지금 크기가 상한(file-size-caps.json)이라 더 커질 수 없다. 줄여서 기준선보다 작아지면
// 상한도 같이 낮춘다(node scripts/check-file-size.mjs --write).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "src");
const CAPS_FILE = path.join(here, "file-size-caps.json");
const MAX_LINES = 800;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !full.includes("types/database.types")) out.push(full);
  }
  return out;
}
const sizes = {};
for (const f of walk(root)) {
  const lines = readFileSync(f, "utf8").split("\n").length;
  if (lines > MAX_LINES) sizes[path.relative(root, f).split(path.sep).join("/")] = lines;
}
if (process.argv.includes("--write")) {
  writeFileSync(CAPS_FILE, JSON.stringify(sizes, null, 2) + "\n");
  console.log(`상한 기록: ${Object.keys(sizes).length}개 파일`);
  process.exit(0);
}
const caps = JSON.parse(readFileSync(CAPS_FILE, "utf8"));
const problems = [], shrunk = [];
for (const [f, n] of Object.entries(sizes)) {
  const cap = caps[f] ?? MAX_LINES;
  if (n > cap) problems.push(`${f}: ${n}줄 (상한 ${cap}) — 새 파일/모듈로 나누세요`);
  else if (caps[f] !== undefined && n < cap) shrunk.push(`${f}: ${cap} → ${n}`);
}
for (const f of Object.keys(caps)) if (!(f in sizes)) shrunk.push(`${f}: 상한 항목 삭제(이제 ${MAX_LINES}줄 이하)`);
if (problems.length) {
  console.error(`파일 크기 검사 실패(새 파일 상한 ${MAX_LINES}줄, 큰 파일은 현재 크기가 상한):\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
if (shrunk.length) {
  // 줄어든 것은 실패가 아니라 안내만 한다(상한을 낮춰 두면 다시 커지는 것을 막을 수 있다).
  console.log("줄었습니다 — 상한을 낮춰 고정하려면 node scripts/check-file-size.mjs --write:\n" + shrunk.map((p) => "  - " + p).join("\n"));
}
console.log(`파일 크기 검사 통과 (${MAX_LINES}줄 초과 파일 ${Object.keys(sizes).length}개, 모두 상한 이내)`);
