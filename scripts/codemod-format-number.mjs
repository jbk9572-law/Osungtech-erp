#!/usr/bin/env node
// 일회성 코드모드 — 인자 없는 `EXPR.toLocaleString()`(숫자 포맷)을 전부
// `formatNumber(EXPR)`로 바꾼다. 날짜 포맷은 이미 전부
// `new Date(x).toLocaleString("ko-KR")`처럼 인자를 명시하고 있어서 이
// 스크립트가 건드리지 않는다(인자 0개인 호출만 대상으로 함).
//
// 실행: node scripts/codemod-format-number.mjs
// (다시 실행해도 안전 — formatNumber(...)로 이미 바뀐 곳은 대상이 아니므로
// 멱등적이다.)

import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");
const FORMAT_NUMBER_MODULE = "@/lib/format-number";

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.(tsx?|mts)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

// format-number.ts 자기 자신은 건드리지 않는다.
const files = walkDir(SRC_ROOT).filter((f) => !f.endsWith("format-number.ts"));

let totalReplacements = 0;
let filesChanged = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const replacements = []; // { start, end, text }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "toLocaleString" &&
      node.arguments.length === 0
    ) {
      const objExpr = node.expression.expression;
      const objText = objExpr.getText(sourceFile);
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: `formatNumber(${objText})`,
      });
      // 이 노드 안쪽은 이미 통째로 대체하므로 더 들어가지 않는다.
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (replacements.length === 0) continue;

  // 뒤에서부터 치환해야 앞쪽 offset이 안 틀어진다.
  replacements.sort((a, b) => b.start - a.start);
  let newText = text;
  for (const r of replacements) {
    newText = newText.slice(0, r.start) + r.text + newText.slice(r.end);
  }

  // import 추가 (이미 있으면 건너뜀).
  if (!new RegExp(`from "${FORMAT_NUMBER_MODULE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(newText)) {
    const importLine = `import { formatNumber } from "${FORMAT_NUMBER_MODULE}";\n`;
    // 마지막 import 문 바로 뒤에 삽입한다 — 없으면 파일 맨 위("use client" 다음)에.
    const importRe = /^import .+ from "[^"]+";\n/gm;
    let lastImportEnd = 0;
    let m;
    while ((m = importRe.exec(newText))) {
      lastImportEnd = m.index + m[0].length;
    }
    if (lastImportEnd > 0) {
      newText = newText.slice(0, lastImportEnd) + importLine + newText.slice(lastImportEnd);
    } else {
      const useClientMatch = newText.match(/^"use client";\n+/);
      const insertAt = useClientMatch ? useClientMatch[0].length : 0;
      newText = newText.slice(0, insertAt) + importLine + "\n" + newText.slice(insertAt);
    }
  }

  writeFileSync(file, newText, "utf8");
  totalReplacements += replacements.length;
  filesChanged += 1;
  console.log(`${path.relative(process.cwd(), file)}: ${replacements.length}건 치환`);
}

console.log(`\n총 ${filesChanged}개 파일, ${totalReplacements}건 치환 완료`);
