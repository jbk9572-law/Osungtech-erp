#!/usr/bin/env node
// "신규" 이동 링크(/…/new)는 빠른 더블클릭으로 같은 주소 이동이 겹쳐 시작되면 모달 없이 빈
// 화면이 되는 현상이 있어(매출/매입 공통 보고) GuardedLink(lib/nav-guard.ts)를 써야 한다.
// 일반 <Link href="…/new">를 새로 쓰면 실패시킨다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
// 모듈 안내 문구 속 인라인 링크, 고객 포털(경로 접두어가 다른 별도 앱)은 대상 아님.
const SKIP = ["modules/", "app/portal/"];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (SKIP.some((s) => rel.startsWith(s))) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/<Link\b[^>]*\bhref="\/[^"]*\/new"/g)) {
    const line = src.slice(0, m.index).split("\n").length;
    problems.push(`${rel}:${line} — <Link href=".../new"> 대신 GuardedLink(@/components/erp/guarded-link)를 쓰세요`);
  }
}
if (problems.length) {
  console.error("신규 이동 링크 보호 검사 실패:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log("신규 이동 링크 보호 검사 통과");
