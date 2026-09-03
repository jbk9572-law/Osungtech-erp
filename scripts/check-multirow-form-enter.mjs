#!/usr/bin/env node
// 여러 줄(품목 등)을 반복 렌더링하는 폼에서 Enter를 치면 폼이 통째로
// 제출되던 버그 — new-sale-form.tsx/new-purchase-form.tsx/payment-
// request-form.tsx는 preventEnterSubmit(src/lib/prevent-enter-submit.ts)
// 으로 이미 고쳐뒀는데, todo-form.tsx는 똑같이 여러 줄짜리 품목 표를
// 쓰면서도 빠져 있었다. "한 곳 고치면 같은 실수가 다른 곳에서 또
// 나온다"는 걸 막으려고, 폼 안에 .map()으로 반복 렌더링하는 부분이
// 있고 실제 입력칸이 2개 이상이면 preventEnterSubmit 연결을 강제한다.
//
// 검사 방법: <form> JSX 엘리먼트를 찾아서, 그 하위에 `.map(콜백)` 호출이
// 있고 그 콜백 함수 본문 안에 hidden/checkbox/radio/submit/button이
// 아닌 <input>이 실제로 들어있는지 본다(= 반복되는 "줄"마다 입력칸이
// 새로 생기는 진짜 다중 행 폼인지) — <option>/<button> 목록처럼 정적
// 선택지를 map으로 렌더링하는 건 제외한다(예: 역할 선택, 결제수단
// 버튼 목록 — 이런 폼은 Enter로 바로 제출되는 게 오히려 정상 UX다).
// 이 조건을 만족하는데 <form> 엘리먼트 자체에 onKeyDown이 없으면
// 위반으로 본다(onKeyDown이 있으면 preventEnterSubmit이든 자체
// 구현이든 인정 — 실제로 Enter를 처리하고 있다는 뜻이므로).
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

const EXCLUDED_INPUT_TYPES = new Set(["hidden", "checkbox", "radio", "submit", "button"]);

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

function isFormElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "form";
}

function isInputElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "input";
}

function isRealInput(inputTagNode) {
  const typeAttr = getAttr(inputTagNode.attributes, "type");
  const typeValue = attrStringValue(typeAttr) ?? "text";
  return !EXCLUDED_INPUT_TYPES.has(typeValue);
}

// subtree 안에 hidden/checkbox/radio/submit/button이 아닌 <input>이
// 하나라도 있으면 true.
function containsRealInput(node) {
  let found = false;
  function visit(n) {
    if (found) return;
    if (ts.isJsxSelfClosingElement(n) && isInputElement(n.tagName) && isRealInput(n)) {
      found = true;
      return;
    }
    if (ts.isJsxOpeningElement(n) && isInputElement(n.tagName) && isRealInput(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return found;
}

// node(폼 JSX 서브트리) 안에서, 콜백 본문 안에 실제 <input>이 들어있는
// .map( 호출이 있는지 찾는다 — 정적 선택지 목록(map으로 <option>/
// <button>만 그리는 경우)은 여기 해당하지 않는다.
function hasRepeatingInputRow(node) {
  let found = false;
  function visit(n) {
    if (found) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "map" &&
      n.arguments.length > 0
    ) {
      const callback = n.arguments[n.arguments.length - 1];
      if (
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        containsRealInput(callback.body)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return found;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    if (ts.isJsxElement(node) && isFormElement(node.openingElement.tagName)) {
      if (hasRepeatingInputRow(node) && !getAttr(node.openingElement.attributes, "onKeyDown")) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          violations.push(key);
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
  console.error("여러 줄을 반복 렌더링하는 폼인데 Enter 키 처리가 없는 곳 발견:\n");
  for (const key of violations) {
    console.error(`  ${key}  — .map()으로 여러 줄을 그리고 입력칸이 2개 이상인데 <form>에 onKeyDown 없음`);
  }
  console.error(
    "\n<form onKeyDown={preventEnterSubmit}>를 추가하세요(src/lib/prevent-enter-submit.ts) — 없으면 여러 줄 중 아무 칸에서나 Enter를 누를 때 폼이 통째로 제출됩니다.",
  );
  console.error(
    "정말 Enter로 제출돼야 하는 폼이라면 scripts/check-multirow-form-enter.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`여러 줄 폼 Enter 키 처리 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
