#!/usr/bin/env node
// 저장형 XSS 재발 방지: dangerouslySetInnerHTML을 직접 쓰면 서버에
// 저장된 HTML(공지사항/전자결재/공문/문서양식/고객지원 등 전부
// RichTextEditor로 작성됨)을 아무 필터 없이 그대로 그리게 된다.
// 에디터 스키마가 제한돼 있어도 그건 클라이언트 UI 제약일 뿐이고,
// 서버 액션이 FormData 문자열을 검증 없이 저장하므로 폼을 직접
// 조작하면 임의 HTML을 저장할 수 있다 — 감사에서 이 패턴이 7곳에
// 흩어져 있던 걸 발견하고 공용 RichTextView(src/components/erp/
// rich-text-view.tsx, sanitize-rich-text.ts로 서버에서 한 번 더
// 걸러냄)로 통합했다. 손으로 또 dangerouslySetInnerHTML을 쓰면
// 똑같은 구멍이 다시 생기니 자동으로 잡는다.
//
// 예외(FILE_ALLOWLIST, 이유를 각 줄에 명시):
// - rich-text-view.tsx 자신: sanitizeRichText를 거친 뒤 그리는
//   유일한 지점이라 여기서만 허용한다.
// - qr-label-card.tsx: 사용자 입력이 아니라 서버에서 QR 라이브러리로
//   그 자리에서 생성한 SVG 문자열이다(외부 콘텐츠 아님).

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const FILE_ALLOWLIST = new Set([
  "src/components/erp/rich-text-view.tsx",
  "src/components/qr-label-card.tsx",
]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function checkFile(filePath) {
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  if (FILE_ALLOWLIST.has(relPath)) return [];

  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name && node.name.text === "dangerouslySetInnerHTML") {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push(`${relPath}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

const files = walkDir(SRC_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error("dangerouslySetInnerHTML을 직접 쓴 곳 발견 (저장형 XSS 위험):\n");
  for (const key of violations) {
    console.error(`  ${key}`);
  }
  console.error(
    "\n<RichTextView html={...} className=... style={...} />(@/components/erp/rich-text-view)를 쓰세요.",
  );
  console.error(
    "사용자 콘텐츠가 아니라 서버가 그 자리에서 생성한 안전한 마크업이라면 scripts/check-dangerous-html.mjs의 FILE_ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`dangerouslySetInnerHTML 직접 사용 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
