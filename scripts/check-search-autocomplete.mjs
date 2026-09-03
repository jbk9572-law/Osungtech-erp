#!/usr/bin/env node
// 검색/필터용 <input type="text">에 autoComplete="off"가 빠지면, 브라우저가
// 예전에 그 필드에 입력했던 값들을 자체 드롭다운으로 띄운다 — 이 앱의
// 검색창은 대부분 자체 자동완성/결과 목록 UI를 갖고 있어서, 브라우저
// 드롭다운이 그 위에 겹쳐 보이거나(특히 리본의 "빠른 검색"처럼 autoFocus로
// 바로 뜨는 모달) 커스텀 검색 결과를 가리는 문제가 반복됐다. 한 군데
// 고치고 나면 다른 검색창에서 또 발견되는 패턴이라 자동 검사로 못 박는다.
//
// 검사 방법: id 또는 placeholder에 "검색"/"search"가 들어간 <input
// type="text">를 찾아 autoComplete 속성이 있는지 확인한다. 없으면 위반으로
// 보고한다.
//
// 오탐이 있으면(정말 브라우저 자동완성이 필요한 검색창이라면) ALLOWLIST에
// "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

const SEARCH_HINT = /검색|search/i;

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

function getAttr(attributes, attrName) {
  return attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name && p.name.text === attrName,
  );
}

function attrStringValue(attr) {
  if (!attr || !attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (
    ts.isJsxExpression(attr.initializer) &&
    attr.initializer.expression &&
    ts.isStringLiteralLike(attr.initializer.expression)
  ) {
    return attr.initializer.expression.text;
  }
  return null;
}

function isTextInput(tagName, attributes) {
  if (tagName !== "input") return false;
  const typeAttr = getAttr(attributes, "type");
  // type 생략은 브라우저 기본값이 "text"이므로 포함한다.
  if (!typeAttr) return true;
  return attrStringValue(typeAttr) === "text";
}

function looksLikeSearchInput(attributes) {
  const idAttr = getAttr(attributes, "id");
  const placeholderAttr = getAttr(attributes, "placeholder");
  const idValue = attrStringValue(idAttr) ?? "";
  const placeholderValue = attrStringValue(placeholderAttr) ?? "";
  return SEARCH_HINT.test(idValue) || SEARCH_HINT.test(placeholderValue);
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visitJsxElement(tagNameNode, attributes, node) {
    if (!ts.isIdentifier(tagNameNode)) return;
    const tagName = tagNameNode.text;
    if (!isTextInput(tagName, attributes)) return;
    if (!looksLikeSearchInput(attributes)) return;
    if (getAttr(attributes, "autoComplete")) return;

    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const key = `${relPath}:${line + 1}`;
    if (!ALLOWLIST.has(key)) {
      violations.push(key);
    }
  }

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)) {
      visitJsxElement(node.tagName, node.attributes, node);
    } else if (ts.isJsxOpeningElement(node)) {
      visitJsxElement(node.tagName, node.attributes, node);
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
  console.error("검색용 입력창에 autoComplete=\"off\"가 빠진 곳 발견:\n");
  for (const key of violations) {
    console.error(`  ${key}  — id/placeholder에 검색 관련 문구가 있는데 autoComplete 속성 없음`);
  }
  console.error(
    "\nautoComplete=\"off\"를 추가하세요 — 없으면 브라우저가 과거 입력값을 자체 드롭다운으로 띄워 앱의 검색결과/자동완성 UI와 겹쳐 보입니다.",
  );
  console.error(
    "정말 브라우저 자동완성이 필요한 필드라면 scripts/check-search-autocomplete.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`검색 입력창 autoComplete 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
