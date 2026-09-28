#!/usr/bin/env node
// 인자 없는 `.toLocaleString()`(숫자 포맷)은 서버(클라우드플레어 Workers)와
// 브라우저의 기본 로케일이 달라질 수 있어 SSR 결과와 하이드레이션 결과의
// 문자열이 어긋나는 하이드레이션 에러의 원인이 될 수 있다(실제로 재고실사
// 화면에서 이 패턴으로 인한 것으로 보이는 크래시가 보고됐다). 날짜 포맷은
// 이미 전부 `new Date(x).toLocaleString("ko-KR")`처럼 로케일을 명시하는
// 관례가 있는데 숫자만 빠져 있었다 — src/lib/format-number.ts의
// formatNumber()로 통일했고, 새 코드에서 같은 실수가 반복되지 않게
// 커밋 시점에 자동으로 잡는다.
//
// 검사 방법: 인자 0개인 `.toLocaleString()` 호출을 찾는다(날짜는 항상
// "ko-KR" 인자를 명시하므로 이 검사에 안 걸린다).

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([
  // formatNumber() 구현 자체 — 여기서만 "ko-KR"를 명시해서 부른다.
  "src/lib/format-number.ts",
]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walkDir(SRC_ROOT);
const violations = [];

for (const file of files) {
  const relPath = path.relative(path.join(__dirname, ".."), file);
  if (ALLOWLIST.has(relPath)) continue;

  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "toLocaleString" &&
      node.arguments.length === 0
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({ relPath, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

if (violations.length > 0) {
  console.error("인자 없는 .toLocaleString() 발견(서버/클라이언트 로케일 불일치로 하이드레이션 에러 위험):\n");
  for (const v of violations) {
    console.error(`  ${v.relPath}:${v.line}`);
  }
  console.error(
    '\n숫자 포맷이면 src/lib/format-number.ts의 formatNumber()를 쓰세요. 날짜 포맷이면 .toLocaleString("ko-KR")처럼 로케일을 명시하세요.'
  );
  process.exit(1);
} else {
  console.log(`로케일 미지정 숫자 포맷 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
