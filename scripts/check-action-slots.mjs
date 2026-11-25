#!/usr/bin/env node
// 상세 화면 버튼 자리(수정 → 인쇄 → 그 밖 → 삭제 맨 오른쪽)는 버튼이 가진 자리 클래스(erp-act-edit / erp-act-print / erp-act-remove)로 정해진다
// (erp-theme.css ".erp-toolbar > .erp-act-*"). 삭제·인쇄 부품(DeleteButton·PrintInPlaceButton)은 스스로 클래스를 갖고,
// 수정 버튼은 링크에 직접 붙여야 한다 — 빠뜨리면 그 화면만 수정 버튼이 다른 자리에 놓인다(전례: 30곳 조사에서 순서 9가지).
// 검사: DetailPageHeader·삭제 버튼을 쓰는 파일에서 "수정" / "F4 수정" 글자의 erp-btn 링크에 erp-act-edit가 없으면 실패한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) && !/classic\.tsx$/.test(n) ? [p] : [];
  });
const problems = [];
for (const f of walk(join(ROOT, "src"))) {
  const src = readFileSync(f, "utf8");
  if (!/DeleteButton|DetailPageHeader/.test(src)) continue;
  for (const m of src.matchAll(/<(Link|GuardedLink)\b[^>]*className="([^"]*)"[^>]*>\s*(?:F4\s*)?수정\s*<\/\1>/g)) {
    if (/erp-btn/.test(m[2]) && !/erp-act-edit/.test(m[2])) problems.push(`  - ${relative(ROOT, f)}:${src.slice(0, m.index).split("\n").length} — 수정 버튼에 erp-act-edit 가 없습니다`);
  }
}
if (problems.length) {
  console.error("상세 화면 버튼 자리 클래스가 빠졌습니다(수정 → 인쇄 → 그 밖 → 삭제 순서가 어긋남):\n" + problems.join("\n"));
  process.exit(1);
}
console.log("상세 화면 버튼 자리 검사 통과");
