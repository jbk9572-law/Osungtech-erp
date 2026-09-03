#!/usr/bin/env node
// 지급결의서 "사용처/용도" 입력칸에서 클릭하면 브라우저가 이전에 입력했던
// 값을 자체 드롭다운으로 띄우는 문제가 보고됐다 — 원인은 name 속성이 있는
// 일반 텍스트 <input>(실제로 <form>이 그대로 제출되는 필드)에
// autoComplete가 없었기 때문이다. 검색창은 이미 check-search-
// autocomplete.mjs로 잡고 있었지만, 그 검사는 id/placeholder에 "검색"이
// 들어간 입력칸만 대상으로 해서 이런 일반 폼 필드는 놓쳤다 — 검사 범위
// 자체를 넓혀서, name이 있고 type이 text(또는 생략)인 입력칸은 전부
// autoComplete 속성이 있는지(값이 "off"든 로그인처럼 의도적으로 브라우저
// 자동완성을 쓰는 "username" 등이든) 확인한다.
//
// 검사 방법: name 속성이 있고 type이 text 또는 생략인 <input>을 찾아
// autoComplete 속성 유무만 확인한다(값은 강제하지 않는다 — 로그인 폼처럼
// 의도적으로 브라우저 자동완성을 쓰고 싶은 곳은 autoComplete="username"
// 등을 명시하면 통과한다). 아예 속성이 없으면 위반으로 본다.
//
// 오탐이 있으면(의도적으로 브라우저 자동완성이 필요한 필드라면)
// ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

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

function hasNameAttr(attributes) {
  const nameAttr = getAttr(attributes, "name");
  // name={someVar}처럼 동적으로 넘기는 경우도 "실제로 폼 필드로 제출된다"는
  // 점은 같으므로, 문자열 리터럴 여부와 무관하게 속성 존재만 확인한다.
  return Boolean(nameAttr);
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
    if (!hasNameAttr(attributes)) return;
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
  console.error("name이 있는 텍스트 입력칸에 autoComplete 속성이 빠진 곳 발견:\n");
  for (const key of violations) {
    console.error(`  ${key}  — name 속성이 있는데 autoComplete 없음`);
  }
  console.error(
    "\nautoComplete=\"off\"를 추가하세요 — 없으면 브라우저가 그 필드에 예전에 입력했던 값을 자체 드롭다운으로 띄웁니다. 로그인처럼 정말 브라우저 자동완성이 필요하면 autoComplete=\"username\" 등 의도를 명시하세요.",
  );
  console.error(
    "오탐이라면 scripts/check-named-input-autocomplete.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`name 있는 입력칸 autoComplete 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
