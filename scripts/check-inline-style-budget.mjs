#!/usr/bin/env node
// 개발헌법 3번(직접 박은 값 금지)을 "늘어나지 않게" 강제하는 래칫 검사.
// 화면 코드의 style={{...}}에 직접 박은 값은 한때 2,700개를 넘었고, 같은 값(예: minWidth: 0,
// marginTop: 8, fontSize: 11)이 수백 곳에 복붙돼 있었다. 이제 반복되는 값은 공용 유틸 클래스(erp-u-*)로
// 옮겼고, 이 검사는 두 가지를 막는다.
//  1) 이미 공용 클래스가 있는 값(예: width: "100%")을 style에 다시 직접 쓰는 것 — 클래스를 쓰세요.
//  2) 범주별(간격/글자/색·테두리/배치/높이/기타) 직접 박은 선언 총량이 기준선(inline-style-budget.json)을
//     넘는 것 — 새 화면은 공용 클래스/토큰으로 만들고, 정리해서 줄이면 기준선도 낮추세요.
// 표 폭(width/minWidth/maxWidth/tableLayout)은 lint(check-fixed-table-columns 등)가 style에서 읽으므로
// 대상이 아니다(범주 집계에서도 제외).
import ts from "typescript";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "src");
const BUDGET_FILE = path.join(here, "inline-style-budget.json");

const EXACT = new Set([
  "minWidth:0", 'width:"100%"', "flex:1", 'flex:"0 0 auto"', 'flexDirection:"column"', 'flexWrap:"wrap"',
  'position:"absolute"', 'textAlign:"right"', 'display:"inline-flex"', 'justifyContent:"center"', 'cursor:"pointer"',
  'gridColumn:"1 / -1"', 'border:"none"', 'border:"1px solid var(--erp-border)"', 'background:"var(--erp-panel)"',
  'background:"var(--erp-bg)"', "fontSize:10.5", "fontSize:11", "fontSize:11.5", "fontSize:12", "fontSize:12.5",
  "fontSize:13", "fontSize:14", "fontSize:16",
  'color:"var(--erp-text-muted)"', 'color:"var(--erp-text)"', 'color:"var(--erp-danger)"', "fontWeight:700",
  "fontWeight:600", "fontWeight:400", 'display:"flex"', 'alignItems:"center"', 'justifyContent:"space-between"',
  'position:"relative"', 'textAlign:"center"', "marginTop:0", "marginBottom:12", "gap:6", "gap:8", 'padding:"0 8px"',
]);
for (const t of ["xs", "sm", "base", "md", "lg", "xl"]) EXACT.add(`fontSize:"var(--erp-font-${t})"`);
const SPACING_PROPS = { marginTop: 1, marginBottom: 1, marginLeft: 1, marginRight: 1, gap: 1, padding: 1 };
const NUMS = new Set([2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24]);
const LINT_TAGS = new Set(["table", "thead", "tbody", "tfoot", "tr", "th", "td", "col", "colgroup"]);
const LINT_PROPS = new Set(["width", "minWidth", "maxWidth", "tableLayout"]);

function category(prop) {
  if (/^(margin|padding|gap|rowGap|columnGap)/.test(prop)) return "spacing";
  if (prop === "fontSize" || prop === "fontWeight" || prop === "lineHeight" || prop === "letterSpacing") return "font";
  if (/^(color|background|border|outline|boxShadow|opacity)/.test(prop)) return "color-border";
  if (/^(display|flex|position|justify|align|grid|top|left|right|bottom|zIndex|overflow|cursor|textAlign)/.test(prop)) return "layout";
  if (/^(height|minHeight|maxHeight)$/.test(prop)) return "size";
  return "other";
}
function hasUtility(prop, val) {
  const key = prop + ":" + (val.kind === "str" ? JSON.stringify(val.text) : val.text);
  if (EXACT.has(key)) return true;
  if (SPACING_PROPS[prop]) {
    if (val.kind === "num" && NUMS.has(Number(val.text))) return true;
    if (val.kind === "str" && /^var\(--erp-space-\d\)$/.test(val.text) && prop !== "padding") return true;
    if (prop === "padding" && val.kind === "str") {
      const m = val.text.match(/^(\d+)(?:px)? (\d+)(?:px)?$/);
      if (m && ((NUMS.has(Number(m[1])) && NUMS.has(Number(m[2]))) || m[1] === "0" || (m[1] === "1" && NUMS.has(Number(m[2]))))) return true;
    }
  }
  return false;
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") && !full.includes(".test.")) out.push(full);
  }
  return out;
}

const counts = { spacing: 0, font: 0, "color-border": 0, layout: 0, size: 0, other: 0 };
let mappable = 0;
for (const file of walk(root)) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  (function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && /^[a-z]/.test(node.tagName.text)) {
      const tag = node.tagName.text;
      const style = node.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.text === "style");
      if (style?.initializer && ts.isJsxExpression(style.initializer) && style.initializer.expression && ts.isObjectLiteralExpression(style.initializer.expression)) {
        for (const p of style.initializer.expression.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
          const prop = p.name.text;
          if (LINT_PROPS.has(prop) && LINT_TAGS.has(tag)) continue;
          if (LINT_PROPS.has(prop)) continue; // 폭/최소폭/최대폭은 내용에 따라 달라 범주 집계 제외
          const v = p.initializer;
          const val = ts.isStringLiteral(v) ? { kind: "str", text: v.text } : ts.isNumericLiteral(v) ? { kind: "num", text: v.text } : null;
          if (!val) continue; // 동적 값(변수/계산식)은 대상이 아니다
          counts[category(prop)] += 1;
          if (hasUtility(prop, val)) mappable += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

const current = { ...counts, mappable };
if (process.argv.includes("--write")) {
  writeFileSync(BUDGET_FILE, JSON.stringify(current, null, 2) + "\n");
  console.log("기준선 기록:", JSON.stringify(current));
  process.exit(0);
}
const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
const problems = [];
const lowered = [];
for (const key of Object.keys(current)) {
  if (current[key] > (budget[key] ?? 0)) problems.push(`${key}: ${current[key]}개 (기준선 ${budget[key] ?? 0}) — ${key === "mappable" ? "이미 공용 클래스가 있는 값을 style에 직접 쓰지 말고 erp-u-* 클래스를 쓰세요" : "새로 직접 박은 값 대신 공용 클래스/토큰(--erp-*)을 쓰세요"}`);
  else if (current[key] < (budget[key] ?? 0)) lowered.push(`${key}: ${budget[key]} → ${current[key]}`);
}
if (problems.length) {
  console.error("직접 박은 style 값 검사 실패:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
if (lowered.length) {
  console.error("정리로 줄었습니다. 기준선을 낮추세요(node scripts/check-inline-style-budget.mjs --write):\n" + lowered.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`직접 박은 style 값 검사 통과 (${JSON.stringify(current)})`);
