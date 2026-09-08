#!/usr/bin/env node
// 보관 위치(랙) 화면에서 <details> 펼침을 막으려고 서버 컴포넌트 안의
// <span>에 onClick={(e) => e.preventDefault()}를 그대로 붙였다가, 실제
// 배포(클라우드플레어)에서 "Event handlers cannot be passed to Client
// Component props" 렌더링 에러로 그 페이지 전체가 죽는 장애가 났다.
// 로컬 next build/tsc는 이 클래스의 오류를 잡지 못한다(정적 타입 체크
// 대상이 아니고, 이 페이지는 동적 렌더링이라 빌드 시점에 실행되지도
// 않는다) — 그래서 같은 실수를 또 하지 않도록 정적 검사로 못 박는다.
//
// 검사 방법: "use client" 지시어가 없는 .ts(x) 파일(=서버 컴포넌트로
// 취급)에서, JSX 속성 이름이 on으로 시작하고 그다음 글자가 대문자인
// 것(onClick, onChange, onSubmit, onKeyDown 등 — React 이벤트 핸들러
// 네이밍 컨벤션)을 찾는다. 서버 컴포넌트는 네이티브 태그든 클라이언트
// 컴포넌트든 함수를 프롭으로 그대로 넘길 수 없으므로(직렬화 불가),
// 이런 속성이 하나라도 있으면 위반으로 본다.
//
// 오탐이 있으면(예: onXxx로 시작하지만 실제로는 함수가 아닌 문자열 값을
// 받는 커스텀 프롭) ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const HANDLER_NAME_RE = /^on[A-Z]/;

const ALLOWLIST = new Set([]);

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

function isUseClientFile(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteralLike(stmt.expression)) {
      if (stmt.expression.text === "use client") return true;
      continue; // 다른 문자열 리터럴 지시어(예: "use strict")는 건너뛰고 계속 찾는다
    }
    break; // 지시어가 아닌 실제 코드가 나오면 더 볼 필요 없음
  }
  return false;
}

function checkFile(file) {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (isUseClientFile(sourceFile)) return [];

  const relPath = path.relative(path.join(__dirname, ".."), file);
  const violations = [];

  function visit(node) {
    if (ts.isJsxAttribute(node) && HANDLER_NAME_RE.test(node.name.getText())) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${relPath}:${line + 1}`;
      if (!ALLOWLIST.has(key)) {
        violations.push({ key, attr: node.name.getText() });
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
  console.error('"use client" 없는 파일(서버 컴포넌트)에 이벤트 핸들러 프롭 발견:\n');
  for (const v of violations) {
    console.error(`  ${v.key}  — ${v.attr}는 서버 컴포넌트에서 함수를 프롭으로 넘길 수 없음`);
  }
  console.error(
    "\n서버 컴포넌트는 네이티브 태그/컴포넌트에 함수(이벤트 핸들러)를 직접 넘길 수 없습니다 — 실제 배포에서 렌더링 에러로 페이지 전체가 죽습니다.",
  );
  console.error(
    "상호작용이 필요하면 그 부분만 별도의 \"use client\" 컴포넌트로 빼세요.",
  );
  process.exit(1);
} else {
  console.log(`서버 컴포넌트 이벤트 핸들러 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
