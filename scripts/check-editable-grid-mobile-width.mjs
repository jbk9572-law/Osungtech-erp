#!/usr/bin/env node
// 품목/라인아이템을 직접 입력하는 표(견적서/구매요청서 등)가
// table-layout: auto(기본값)인 채로 칸 일부에만 <th style={{width}}>가
// 있으면, 좁은(모바일) 화면에서 입력칸이 글자 하나 들어갈 폭까지
// 찌그러지고 그 안의 검색 드롭다운(ProductSearchSelect 등)도 찌그러진
// 폭을 그대로 물려받아 글자가 겹쳐 보이는 버그가 난다 — 실제로 견적서
// 작성 화면에서 이 증상으로 사용자가 제보했다(그 화면 포함 4개 화면을
// 고쳤다: new-quote-form.tsx 등). 같은 패턴이 급여/실사/포털주문 등
// 다른 편집 가능 그리드에도 반복될 수 있어, 새 표를 추가할 때마다
// 사람이 매번 기억해야 하는 대신 정적 검사로 잡는다.
//
// 검사 방법: className에 "erp-grid"가 있는 <table> 중,
//   - style에 tableLayout: "fixed"가 없고(= 기본 auto)
//   - <thead> 첫 <tr>의 <th> 중 일부에만 width 스타일이 있고(전부 있거나
//     전부 없으면 대상 아님 — 전부 없으면 애초에 "이 폭대로" 의도가
//     없었다는 뜻이라 이 버그 패턴이 아니다)
//   - 표 안(주로 tbody)에 사용자가 입력하는 요소(<input>/<select>/
//     <textarea> 또는 ProductSearchSelect/PartySearchSelect/NumberInput류
//     컴포넌트)가 하나라도 있으면
// 위반으로 본다.
//
// 권장 해결책: new-quote-form.tsx처럼 모든 <th>에 width를 주고, <table
// className="erp-grid">의 style에 tableLayout:"fixed"와 그 폭의 합만큼
// width/minWidth를 고정한다(또는 new-sale-form.tsx처럼 드래그 가능한
// 칸이 필요하면 use-resizable-columns.ts를 쓴다). 그러면
// check-fixed-table-columns.mjs가 이어서 폭 계산 자체의 정합성을
// 검사해준다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

// 표 안에서 "사용자가 입력하는 요소"로 칠 컴포넌트 이름(소문자 HTML
// 태그는 아래 로직에서 따로 본다). employee-pay-form.tsx처럼 실제
// 입력칸이 다른 파일에 정의된 셀 전용 컴포넌트로 감싸져 있는 경우(예:
// <EmployeePayForm />)는 그 파일을 따로 열어보지 않는 한 이 스크립트가
// 못 잡는다 — 이런 "표 셀 전용 폼" 컴포넌트를 새로 만들 때는 이름을
// 여기 추가하거나, 직접 모바일 폭을 확인해라.
const EDITABLE_COMPONENT_NAMES = new Set([
  "ProductSearchSelect",
  "PartySearchSelect",
  "NumberInput",
  "QuantityWithBoxInput",
  "EmployeePayForm",
  "PayslipBonusForm",
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

function isTableElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "table";
}

function isThElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "th";
}

function stringLiteralText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function readStyleObject(attributes) {
  const styleAttr = attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name && p.name.text === "style",
  );
  if (!styleAttr || !styleAttr.initializer || !ts.isJsxExpression(styleAttr.initializer)) return null;
  const expr = styleAttr.initializer.expression;
  if (!expr || !ts.isObjectLiteralExpression(expr)) return null;

  const map = new Map();
  for (const prop of expr.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = prop.name.getText().replace(/["']/g, "");
    map.set(key, { literal: stringLiteralText(prop.initializer) });
  }
  return map;
}

function hasFixedTableLayout(style) {
  if (!style) return false;
  return style.get("tableLayout")?.literal === "fixed";
}

function classNameIncludesErpGrid(attributes) {
  const classAttr = attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name && p.name.text === "className",
  );
  if (!classAttr || !classAttr.initializer) return false;
  if (ts.isStringLiteral(classAttr.initializer)) {
    return classAttr.initializer.text.split(/\s+/).includes("erp-grid");
  }
  if (ts.isJsxExpression(classAttr.initializer) && classAttr.initializer.expression) {
    // 템플릿 리터럴/삼항식 등 동적 className은 텍스트에 "erp-grid"가
    // 보이면 보수적으로 대상에 포함시킨다(놓치는 쪽보다 과검출이 낫다).
    return classAttr.initializer.expression.getText().includes("erp-grid");
  }
  return false;
}

function findFirstHeaderRowThs(tableNode) {
  let ths = null;
  function visit(n) {
    if (ths) return;
    if (ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && n.openingElement.tagName.text === "tr") {
      const found = [];
      for (const child of n.children) {
        if (ts.isJsxElement(child) && isThElement(child.openingElement.tagName)) {
          found.push(child.openingElement);
        } else if (ts.isJsxSelfClosingElement(child) && isThElement(child.tagName)) {
          found.push(child);
        }
      }
      if (found.length > 0) {
        ths = found;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(tableNode);
  return ths ?? [];
}

// 체크박스/라디오(전체선택 등)는 애초에 작아서 모바일에서 찌그러져도
// 못 쓰게 되는 종류의 문제가 아니다 — 매출/매입 목록의 "전체 선택"
// 체크박스 칸 때문에 과검출되는 걸 막는다.
function inputTypeAttr(attributes) {
  const typeAttr = attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name && p.name.text === "type",
  );
  if (!typeAttr || !typeAttr.initializer) return null;
  if (ts.isStringLiteral(typeAttr.initializer)) return typeAttr.initializer.text;
  if (ts.isJsxExpression(typeAttr.initializer) && typeAttr.initializer.expression) {
    return stringLiteralText(typeAttr.initializer.expression);
  }
  return null;
}

function hasEditableCell(tableNode) {
  let found = false;
  function visit(n) {
    if (found) return;
    const attributes = ts.isJsxElement(n)
      ? n.openingElement.attributes
      : ts.isJsxSelfClosingElement(n)
        ? n.attributes
        : null;
    const tagName = ts.isJsxElement(n)
      ? n.openingElement.tagName
      : ts.isJsxSelfClosingElement(n)
        ? n.tagName
        : null;
    if (tagName && ts.isIdentifier(tagName) && attributes) {
      const name = tagName.text;
      if (name === "input") {
        const type = inputTypeAttr(attributes);
        if (type !== "checkbox" && type !== "radio") {
          found = true;
          return;
        }
      } else if (name === "select" || name === "textarea" || EDITABLE_COMPONENT_NAMES.has(name)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(tableNode);
  return found;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    const isTableJsxElement = ts.isJsxElement(node) && isTableElement(node.openingElement.tagName);
    if (isTableJsxElement) {
      const openingElement = node.openingElement;
      if (classNameIncludesErpGrid(openingElement.attributes)) {
        const style = readStyleObject(openingElement.attributes);
        if (!hasFixedTableLayout(style)) {
          const ths = findFirstHeaderRowThs(node);
          if (ths.length > 1) {
            const widthCount = ths.filter((th) => readStyleObject(th.attributes)?.has("width")).length;
            const partialWidth = widthCount > 0 && widthCount < ths.length;
            if (partialWidth && hasEditableCell(node)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              const key = `${relPath}:${line + 1}`;
              if (!ALLOWLIST.has(key)) {
                violations.push(key);
              }
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
  console.error("모바일에서 입력칸이 찌그러질 수 있는 편집 가능 표 발견:\n");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    "\ntable-layout: auto인 채로 칸 일부에만 width가 있고 입력 요소도 있는 표는, 좁은 화면에서 입력칸이 찌그러지고 그 안 검색 드롭다운도 같이 깨져 보입니다.",
  );
  console.error(
    "new-quote-form.tsx처럼 모든 <th>에 width를 주고 <table>에 tableLayout:\"fixed\" + 칸 폭 합만큼 width/minWidth를 고정하세요.",
  );
  console.error(
    "정말 의도한 경우(화면 폭에 비해 표가 항상 충분히 좁음 등)라면 scripts/check-editable-grid-mobile-width.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`편집 가능 표 모바일 폭 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
