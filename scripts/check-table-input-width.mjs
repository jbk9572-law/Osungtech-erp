#!/usr/bin/env node
// 표(<td>) 안에 들어가는 <input>/<select>가 width를 안 주면 브라우저
// 기본 폭(대략 180px)으로 렌더링돼, 칸이 그보다 좁은 열(규격/수량/단가
// 등)에서는 입력칸이 옆 칸을 침범해 보인다 — 사용자가 "입력 폼이 다른
// 칸을 잡아먹는다"고 보고한 실제 버그(new-quote-form.tsx 등 7개
// 파일에서 발견, geometry로 확인: 179px 입력칸이 140px짜리 칸에 들어가
// 다음 칸을 49px 침범). 재발 방지로 자동화한다.
//
// 검사 방법: <td> 바로 아래(직계 자식 또는 한 겹 wrapper 안)의 <input>/
// <select>가 className에 "w-full"이 없고 style에도 width가 없으면
// 위반으로 본다. <NumberInput>은 컴포넌트 자체가 항상 width:100%를
// 적용하므로(number-input.tsx) 대상에서 뺀다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

const SKIP_TAGS = new Set(["NumberInput"]);

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

function attrText(attributes, attrName) {
  const attr = getAttr(attributes, attrName);
  if (!attr || !attr.initializer) return "";
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return attr.initializer.expression.getText();
  }
  return "";
}

const SKIP_INPUT_TYPES = new Set(["checkbox", "radio", "hidden"]);

function isSkippableInputType(attributes) {
  const typeValue = attrText(attributes, "type");
  return SKIP_INPUT_TYPES.has(typeValue);
}

function hasExplicitWidth(attributes) {
  const className = attrText(attributes, "className");
  if (/\bw-full\b/.test(className) || /\bwidth\s*:/.test(className)) return true;
  const style = attrText(attributes, "style");
  if (/width\s*:/.test(style)) return true;
  return false;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  // <td> 아래(최대 2단계 — td>input, td>div>input 정도)에서 input/select를 찾는다.
  function findInputsNear(node, depth) {
    const found = [];
    if (depth > 2) return found;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = opening.tagName;
      if (ts.isIdentifier(tagName)) {
        if (["input", "select"].includes(tagName.text)) {
          found.push({ node, opening });
          return found; // 이 input 자체는 더 안 내려간다
        }
        if (SKIP_TAGS.has(tagName.text)) {
          return found; // NumberInput 등은 스킵하고 더 안 내려간다
        }
      }
    }
    ts.forEachChild(node, (child) => {
      found.push(...findInputsNear(child, depth + 1));
    });
    return found;
  }

  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName;
      if (ts.isIdentifier(tagName) && tagName.text === "td") {
        for (const { node: inputNode, opening } of findInputsNear(node, 0)) {
          if (isSkippableInputType(opening.attributes)) continue;
          if (!hasExplicitWidth(opening.attributes)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(inputNode.getStart());
            const key = `${relPath}:${line + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push(key);
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
  console.error("표 칸(<td>) 안의 <input>/<select>에 width 지정이 없는 곳 발견(옆 칸을 침범할 수 있음):\n");
  for (const key of violations) {
    console.error(`  ${key}`);
  }
  console.error(
    '\nclassName에 "w-full"을 추가하거나 style={{ width: "100%" }}을 주세요.',
  );
  console.error(
    "정말 자연스러운 폭이 맞다면(드묾) scripts/check-table-input-width.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`표 칸 입력폭 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
