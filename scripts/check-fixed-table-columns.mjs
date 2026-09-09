#!/usr/bin/env node
// tableLayout:"fixed"를 쓰는 표에서 두 번 연달아 같은 종류의 버그가
// 났다: (1) 칸 일부에만 폭을 주면 폭을 안 준 칸이 표 남는 폭을 전부
// 떠안아서 입력칸 왼쪽에 큰 빈 공간이 생기고, (2) 그걸 고친다고 표
// 자체를 width:auto/fit-content로 줄이면 이번엔 표가 컨테이너보다
// 작아져서 화면이 반쯤 잘린 것처럼 보인다. 두 경우 다 사람이 실제
// 화면을 보고서야 알아챘고 앞으로도 표를 새로 만들 때마다 반복될 수
// 있는 실수라, 코드만 보고도 잡아내게 정적 검사로 만든다.
//
// 검사 방법: <table> JSX 엘리먼트의 style={{...}}에서
// tableLayout: "fixed"(또는 "table-layout": "fixed")를 찾는다. 그 표에
// 대해 두 가지를 본다.
//   A) 같은 style 객체에 width: "auto" 또는 "fit-content"가 있으면
//      위반 — 표가 컨테이너보다 작아져 잘려 보일 수 있다.
//   B) <thead>의 첫 <tr> 안 <th> 중 일부만 style에 width가 있고 나머지는
//      없으면 위반 — 폭 없는 칸이 남는 폭을 전부 떠안는다. (전부 폭이
//      있거나 전부 없으면 위반 아님 — 전부 없으면 브라우저 기본 자동
//      배분이라 이 버그가 안 생긴다.)
//   C) 칸 폭에 %가 하나라도 있는데 표 자체에 minWidth가 없으면 위반 —
//      %만 있으면 좁은(모바일) 화면에서 입력칸/버튼이 다 찌그러진다
//      (실제로 이 버그로 모바일 화면이 깨졌었다). minWidth로 바닥을
//      깔아서 그 밑으로는 erp-grid-wrap의 overflow:auto가 가로
//      스크롤을 대신하게 해야 한다.
//
// 권장 해결책: 모든 칸에 %로 폭을 주고 합이 100%가 되게 하면서(표는
// width:100%인 기본값 그대로) 표에 minWidth도 같이 주면 세 문제가
// 동시에 해결된다 — location-stock-form.tsx / locations/[code]/page.tsx
// 참고.
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

function isTableElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "table";
}

function isThElement(tagName) {
  return ts.isIdentifier(tagName) && tagName.text === "th";
}

function stringLiteralText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

// 값이 (직접 또는 삼항식의 양쪽 분기 모두) "%"로 끝나는 문자열 리터럴인지
// 본다 — width: cond ? "4%" : "6%" 처럼 조건부로 %를 주는 경우도 있어서다.
function looksLikePercent(initExpr) {
  const direct = stringLiteralText(initExpr);
  if (direct !== null) return direct.endsWith("%");
  if (ts.isConditionalExpression(initExpr)) {
    const a = stringLiteralText(initExpr.whenTrue);
    const b = stringLiteralText(initExpr.whenFalse);
    if (a !== null && b !== null) return a.endsWith("%") && b.endsWith("%");
  }
  return false;
}

// style={{ a: "b", c: 1 }} 형태의 JSX style 속성에서 프로퍼티 이름 ->
// { literal: 문자열 리터럴이면 그 텍스트(아니면 null), percent: %로 끝나는
// 값인지(삼항식의 양쪽 분기 포함) } 맵을 만든다. 프로퍼티 자체가 있는지는
// map.has(key)로 확인한다 — 값이 삼항식이라 literal이 null이어도
// "폭을 준 칸"으로는 쳐야 오탐이 안 난다.
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
    map.set(key, { literal: stringLiteralText(prop.initializer), percent: looksLikePercent(prop.initializer) });
  }
  return map;
}

function hasFixedTableLayout(style) {
  if (!style) return false;
  return style.get("tableLayout")?.literal === "fixed";
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

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    const isTableJsxElement = ts.isJsxElement(node) && isTableElement(node.openingElement.tagName);
    const isTableSelfClosing = ts.isJsxSelfClosingElement(node) && isTableElement(node.tagName);
    if (isTableJsxElement || isTableSelfClosing) {
      const openingElement = isTableJsxElement ? node.openingElement : node;
      const style = readStyleObject(openingElement.attributes);
      if (hasFixedTableLayout(style)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          const width = style.get("width")?.literal;
          if (width === "auto" || width === "fit-content") {
            violations.push({
              key,
              reason: `표 자체에 width: "${width}"가 있어 컨테이너보다 작아져 잘려 보일 수 있음`,
            });
          }
          if (isTableJsxElement) {
            const ths = findFirstHeaderRowThs(node);
            if (ths.length > 1) {
              const thWidths = ths.map((th) => readStyleObject(th.attributes)?.get("width"));
              const withCount = thWidths.filter((w) => w !== undefined).length;
              if (withCount > 0 && withCount < thWidths.length) {
                violations.push({
                  key,
                  reason: "칸 일부에만 폭이 있어 폭 없는 칸이 남는 폭을 전부 떠안을 수 있음",
                });
              }
              const hasPercentWidth = thWidths.some((w) => w?.percent);
              if (hasPercentWidth && !style.has("minWidth")) {
                violations.push({
                  key,
                  reason:
                    "칸 폭이 %인데 표에 minWidth가 없어 좁은(모바일) 화면에서 입력칸/버튼이 찌그러질 수 있음",
                });
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
  console.error("tableLayout: fixed 표에서 폭 계산이 깨질 수 있는 곳 발견:\n");
  for (const v of violations) {
    console.error(`  ${v.key}  — ${v.reason}`);
  }
  console.error(
    "\n모든 칸에 %로 폭을 줘서 합이 100%가 되게 하세요(표는 기본값 width:100% 그대로) — 그러면 표가 컨테이너를 항상 꽉 채우면서 칸 비율도 고정됩니다.",
  );
  console.error(
    "정말 의도한 경우라면 scripts/check-fixed-table-columns.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`고정폭 표 칸 계산 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
