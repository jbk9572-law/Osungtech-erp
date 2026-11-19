#!/usr/bin/env node
// "저장되었습니다"라고 하면서 실제로는 0건을 바꾼 UPDATE(회사정보 저장 버그 — 행이 없으면 에러 없이 0건 갱신)를 새로 만들지 못하게 한다.
// 서버 액션 파일("use server")의 `.from(...).update(...)` 체인이 `.select(...)`/`.single()`/`.maybeSingle()`로 바뀐 행을 돌려받지 않으면
// "행 수 미확인" UPDATE로 센다. 이미 있는 곳은 기준선(scripts/update-affected-rows-baseline.json)에 파일별 개수로 기록하고,
// 기준선보다 늘면 실패한다(줄이면 `--write`로 기준선도 같이 낮춘다). 회사정보 쓰기는 lib/company-profile-write.ts(행 수 확인 포함)를 쓴다.
import ts from "typescript";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const BASELINE = path.join(__dirname, "update-affected-rows-baseline.json");
const RETURNING = new Set(["select", "single", "maybeSingle"]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function isSupabaseTableUpdate(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== "update") return false;
  let cur = node.expression.expression;
  while (cur) {
    if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
      if (cur.expression.name.text === "from") return true;
      cur = cur.expression.expression;
    } else if (ts.isPropertyAccessExpression(cur)) cur = cur.expression;
    else return false;
  }
  return false;
}

function hasReturning(node) {
  let expr = node;
  while (
    expr.parent && ts.isPropertyAccessExpression(expr.parent) && expr.parent.expression === expr &&
    expr.parent.parent && ts.isCallExpression(expr.parent.parent) && expr.parent.parent.expression === expr.parent
  ) {
    if (RETURNING.has(expr.parent.name.text)) return true;
    expr = expr.parent.parent;
  }
  return false;
}

const counts = {};
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  if (!/^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let n = 0;
  (function visit(node) {
    if (isSupabaseTableUpdate(node) && !hasReturning(node)) n++;
    ts.forEachChild(node, visit);
  })(sf);
  if (n > 0) counts[path.relative(ROOT, file)] = n;
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`기준선 기록: ${Object.keys(counts).length}개 파일, 행 수 미확인 UPDATE ${total}건`);
  process.exit(0);
}
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const errors = [];
for (const [file, n] of Object.entries(counts)) {
  if (n > (baseline[file] ?? 0)) errors.push(`${file}: 행 수 미확인 UPDATE ${n}건(기준선 ${baseline[file] ?? 0}건) — .select("id")로 바뀐 행을 확인하세요`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  console.error("\n0건을 바꿔도 성공으로 보이면 '저장되었습니다'가 거짓이 됩니다. 새 UPDATE는 .select(\"id\")로 행 수를 확인하고, 없으면 실패를 돌려주세요.");
  process.exit(1);
}
console.log(`UPDATE 행 수 검사 통과 (행 수 미확인 ${total}건은 기준선 이내 — 줄이면 --write로 기준선을 낮추세요)`);
