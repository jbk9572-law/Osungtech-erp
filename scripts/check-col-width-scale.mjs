#!/usr/bin/env node
// 표 열 폭 단계(design/COMPONENTS.md §1)를 지키게 하는 검사.
// <th>·<col>의 style에 숫자 width(30~260px)를 직접 박으면 실패한다 — 같은 열 폭이 47가지로 흩어졌던 파편화를 다시 만들지 않으려는 것이다.
// 대신 className="erp-col-xxs|xs|s|m|l|xl|xxl|w|xw"를 쓴다. (% 폭, 260px 초과, 동적 값, 클래식 동결본·인쇄 서식은 대상이 아니다.)
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const walk = (d, o = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (f.endsWith(".tsx") && !f.includes(".test.") && e.name !== "classic.tsx" && !/Invoice|print/i.test(f)) o.push(f);
  }
  return o;
};
const bad = [];
for (const file of walk(root)) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  (function visit(n) {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName) && (n.tagName.text === "th" || n.tagName.text === "col")) {
      const st = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.text === "style");
      if (st?.initializer && ts.isJsxExpression(st.initializer) && st.initializer.expression && ts.isObjectLiteralExpression(st.initializer.expression)) {
        for (const p of st.initializer.expression.properties) {
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "width" && ts.isNumericLiteral(p.initializer)) {
            const v = Number(p.initializer.text);
            if (v >= 30 && v <= 260) bad.push(`${path.relative(path.join(root, ".."), file)}:${sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1} width: ${v}`);
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}
if (bad.length) {
  console.error("표 열 폭 단계 검사 실패 — 숫자 width 대신 className=\"erp-col-<단계>\"를 쓰세요(design/COMPONENTS.md §1):\n" + bad.map((b) => "  - " + b).join("\n"));
  process.exit(1);
}
console.log("표 열 폭 단계 검사 통과 (th·col에 직접 박은 숫자 폭 없음)");
