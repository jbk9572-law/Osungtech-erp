#!/usr/bin/env node
// 개발헌법 3번("색은 전부 CSS 변수(--erp-*)로만 쓴다")에 따라, 인라인
// style 안에 hex 색상(#fff, #132944 등)을 직접 박아넣는 걸 자동으로
// 잡는다. 감사 중 "흰 글자 on 색배경"에 전용 토큰(--erp-on-primary)이
// 없어서 7~10곳이 각자 "#fff"를 반복하던 걸 찾아 통합했는데, 손으로 또
// 새로 생기면 똑같이 또 찾아야 하니 자동화한다.
//
// 검사 방법: JSX style={{ ... }} 객체 리터럴 안의 문자열 프로퍼티 값이
// hex 색상 패턴(#abc, #aabbcc) 또는 rgb()/rgba() 리터럴이면 위반으로
// 잡는다(감사에서 receipt-gallery.tsx의 rgba(255,255,255,0.15)가 hex만
// 잡던 정규식의 사각지대로 남아있던 걸 발견해 범위를 넓혔다).
//
// 예외(파일 전체를 FILE_ALLOWLIST에 둔다, 이유는 각 줄에 명시):
// - 인쇄(print) 전용 페이지/카드: 인쇄물은 화면 테마(다크모드 등)와
//   무관하게 항상 검정 잉크여야 해서 CSS 변수를 쓰면 안 된다.
// - 에러 바운더리(error.tsx/global-error.tsx)·icon.tsx: 애초에 앱
//   CSS(erp-theme.css)가 아예 로딩되지 않은 상태에서도 렌더링돼야 해서
//   CSS 변수 자체를 못 쓴다.
// - rich-text-editor.tsx: 사용자가 "문서 내용"에 직접 고르는 글자색
//   팔레트다 — 테넌트별 테마가 바뀌어도 이미 저장된 문서 색은 그대로
//   유지돼야 하므로 디자인 토큰이 아니라 콘텐츠 값이다.
// - inventory-qr-scanner.tsx: 카메라 실시간 영상 위에 뜨는 반투명
//   오버레이 글자색이다 — "primary 배경 위" 같은 앱 배경이 아니라
//   예측 불가능한 카메라 화면 위에서 대비를 보장해야 해서 앱 테마
//   토큰과는 성격이 다르다.
//
// 오탐이 있으면 FILE_ALLOWLIST 또는 ALLOWLIST(파일:줄번호)에 이유와
// 함께 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const FILE_ALLOWLIST = new Set([
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/(dashboard)/icon.tsx",
  "src/components/rich-text-editor.tsx",
  "src/components/inventory-qr-scanner.tsx",
  "src/components/qr-label-card.tsx",
  "src/components/delivery-note-v2/shared.tsx",
  "src/app/(dashboard)/inventory/count/print/page.tsx",
  "src/app/(dashboard)/production/[id]/print/page.tsx",
  "src/app/(dashboard)/reports/payment-requests/[id]/print/page.tsx",
]);

const ALLOWLIST = new Set([]);

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;

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
    // style={{ ... }} 형태의 JSX 속성만 본다 — 일반 변수/배열 등은 대상이 아니다.
    if (
      ts.isJsxAttribute(node) &&
      node.name &&
      node.name.text === "style" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isObjectLiteralExpression(node.initializer.expression)
    ) {
      for (const prop of node.initializer.expression.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)) {
          if (HEX_COLOR.test(prop.initializer.text.trim())) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(prop.getStart());
            const key = `${relPath}:${line + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push({ key, value: prop.initializer.text });
            }
          }
        }
      }
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
  console.error("인라인 style에 hex 색상을 직접 박아넣은 곳 발견:\n");
  for (const { key, value } of violations) {
    console.error(`  ${key}  — "${value}"`);
  }
  console.error(
    "\nerp-theme.css의 --erp-* 변수를 쓰세요. 없는 색이면 변수를 새로 추가하세요(예: --erp-on-primary).",
  );
  console.error(
    "앱 CSS를 쓸 수 없는 진짜 예외(인쇄물/에러 바운더리/카메라 오버레이 등)라면 scripts/check-hardcoded-hex-color.mjs의 FILE_ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`하드코딩 hex 색상 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
