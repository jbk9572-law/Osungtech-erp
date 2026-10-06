#!/usr/bin/env node
// announcements/page.tsx(서버 컴포넌트)가 rowHref라는 지역 화살표 함수를
// 그대로 만들어서 "use client" 컴포넌트(AnnouncementListBody)의 prop으로
// 넘겼다가, 실제 배포(RSC 직렬화 경계)에서 "Minified React error #441"로
// 공지사항 화면 전체가 죽는 장애가 났다. check-server-component-handlers.mjs가
// onClick류 이벤트 핸들러 프롭은 이미 잡아주지만, rowHref처럼 이름이
// on으로 시작하지 않는 일반 콜백 프롭은 그 검사망에 걸리지 않는다 —
// 같은 근본 원인(서버 컴포넌트가 만든 함수는 클라이언트 컴포넌트로 건널
// 수 없음)의 또 다른 모양이라 별도 검사로 잡는다.
//
// 검사 방법: "use client" 지시어가 없는 .tsx 파일(=서버 컴포넌트)에서,
// 그 파일 안에서 지역적으로 정의된 함수(const name = (...) => ... /
// const name = arg => ... / function name(...) {...})의 이름을 모아둔다.
// 그 다음 대문자로 시작하는 JSX 태그(커스텀 컴포넌트 — 네이티브 DOM
// 태그는 제외)의 속성값이 그 함수 이름을 "그대로"(호출하지 않고) 참조하면
// 위반으로 본다 — action={importedServerAction}처럼 별도 "use server"
// 파일에서 가져온 함수는 이 지역 함수 목록에 없으므로 걸리지 않는다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

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
      continue;
    }
    break;
  }
  return false;
}

function collectLocalFunctionNames(sourceFile) {
  const names = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer)
    ) {
      names.add(node.name.text);
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return names;
}

function isCapitalizedTag(tagNameNode) {
  const text = tagNameNode.getText();
  return /^[A-Z]/.test(text);
}

function checkFile(file) {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (isUseClientFile(sourceFile)) return [];

  const localFns = collectLocalFunctionNames(sourceFile);
  if (localFns.size === 0) return [];

  const relPath = path.relative(path.join(__dirname, ".."), file);
  const violations = [];

  function visitAttr(attrNode, tagNameNode) {
    if (!ts.isJsxAttribute(attrNode) || !attrNode.initializer) return;
    if (!ts.isJsxExpression(attrNode.initializer) || !attrNode.initializer.expression) return;
    const expr = attrNode.initializer.expression;
    if (ts.isIdentifier(expr) && localFns.has(expr.text) && isCapitalizedTag(tagNameNode)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(attrNode.getStart());
      const key = `${relPath}:${line + 1}`;
      if (!ALLOWLIST.has(key)) {
        violations.push({ key, attr: attrNode.name.getText(), fn: expr.text });
      }
    }
  }

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) visitAttr(attr, node.tagName);
    } else if (ts.isJsxOpeningElement(node)) {
      for (const attr of node.attributes.properties) visitAttr(attr, node.tagName);
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
  console.error('"use client" 없는 파일(서버 컴포넌트)에서 지역 함수를 컴포넌트 프롭으로 그대로 전달:\n');
  for (const v of violations) {
    console.error(`  ${v.key}  — ${v.attr}={${v.fn}}`);
  }
  console.error(
    "\n서버 컴포넌트가 만든 함수(클로저)는 \"use client\" 컴포넌트의 프롭으로 그대로 넘길 수 없습니다 — " +
      "실제 배포에서 RSC 직렬화 에러(Minified React error #441)로 그 화면 전체가 죽습니다.",
  );
  console.error(
    "href 등 문자열로 표현 가능하면 문자열(또는 베이스 경로)만 넘기고 클라이언트 컴포넌트 안에서 직접 조립하세요.",
  );
  process.exit(1);
} else {
  console.log(`클라이언트 컴포넌트 함수 프롭 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
