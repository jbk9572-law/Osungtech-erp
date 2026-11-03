#!/usr/bin/env node
// 수량 입력칸에서 "=10+5"처럼 엑셀식 계산이 되는 건 NumberInput/
// QuantityWithBoxInput의 allowFormula 옵션인데, 매출/매입 등록·모조지
// 계산 화면에만 켜져 있고 할일관리·재고조정·재고실사·견적서·매입요청·
// 매입견적요청·재고이동·세금계산서 같은 다른 화면들은 똑같이 수량을
// 입력하면서도 빠져 있었다(사용자 지적: "앱 전체에 수량입력하는곳은 다
// 되어야하는거 아니야?"). 같은 실수가 새 화면에서 또 반복되지 않도록,
// 수량 필드에 바인딩된 NumberInput/QuantityWithBoxInput은 전부
// allowFormula가 있는지 검사한다.
//
// 검사 대상: <QuantityWithBoxInput>은 컴포넌트 이름 자체가 "수량"이라
// 무조건 검사하고, <NumberInput>은 value에 바인딩된 표현식 텍스트에
// "quantity" 또는 "qty"가 들어있을 때만 검사한다(단가 등 다른 숫자
// 필드까지 강제하지 않기 위해).
//
// 오탐이 있으면(그 화면에서 수량이 정말 수식 입력이 의미 없는 특수
// 상황이라면) ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

// 컴포넌트 정의 파일 자신은 검사 대상에서 뺀다(allowFormula를 선언/
// 전달만 하지 실제 "수량 필드 사용처"가 아니다).
const SKIP_FILES = new Set(["number-input.tsx", "quantity-with-box-input.tsx"]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith(".test.tsx") && !SKIP_FILES.has(entry.name)) {
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

const QUANTITY_NAME = /quantity|qty/i;

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visitJsxElement(tagNameNode, attributes, node) {
    if (!ts.isIdentifier(tagNameNode)) return;
    const tagName = tagNameNode.text;
    if (tagName !== "NumberInput" && tagName !== "QuantityWithBoxInput") return;

    if (tagName === "NumberInput") {
      const valueAttr = getAttr(attributes, "value");
      const valueText = valueAttr?.initializer?.getText(sourceFile) ?? "";
      if (!QUANTITY_NAME.test(valueText)) return;
    }

    if (getAttr(attributes, "allowFormula")) return;

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
  console.error("수량 입력칸에 allowFormula(엑셀식 계산)가 빠진 곳 발견:\n");
  for (const key of violations) {
    console.error(`  ${key}  — allowFormula 없음`);
  }
  console.error(
    "\n매출/매입 등록 화면처럼 allowFormula를 추가하세요 — 수량칸에 \"=10+5\" 입력하면 포커스를 벗어날 때 15로 계산됩니다.",
  );
  console.error(
    "오탐이라면 scripts/check-quantity-formula-input.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`수량 입력칸 엑셀식 계산 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
