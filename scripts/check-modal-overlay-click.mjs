#!/usr/bin/env node
// 직접 만든 모달 배경(<div className="erp-modal-overlay" onClick=...>)은 입력칸 안에서 글자를 끌다가 배경 위에서 손을 떼면 모달이 닫힌다(click이 배경에서 발생).
// 공용 ModalOverlay(components/erp/modal-overlay.tsx)나 registration-modal-shell 처럼 "배경을 누른 자리(mousedown)"가 배경일 때만 닫는 틀을 써야 한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const ROOT = process.cwd();
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === "node_modules" || n.startsWith(".") ? [] : statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) ? [p] : []; });
const bad = [];
for (const f of walk(join(ROOT, "src"))) {
  const src = readFileSync(f, "utf8");
  const re = /className="erp-modal-overlay"[^>]*\bonClick=/g;
  let m;
  while ((m = re.exec(src))) bad.push(`${relative(ROOT, f)}:${src.slice(0, m.index).split("\n").length}`);
}
if (bad.length) {
  console.error("배경을 click으로 닫는 직접 만든 모달이 있습니다 — <ModalOverlay>(components/erp/modal-overlay.tsx)를 쓰세요:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("모달 배경 닫기 검사 통과");
