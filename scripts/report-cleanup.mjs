#!/usr/bin/env node
// 정비 성과표 — "시작 시점" 소스와 "지금" 소스를 같은 방법으로 재서 얼마나 줄였고 얼마나 바꿨는지 표로 보여준다.
// 사용법: node scripts/report-cleanup.mjs [--base=<커밋>]   (기본 기준: 정비 시작 직전 커밋 96b476a)
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "96b476a";
const repo = process.cwd();
const walk = (d, o = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (f.endsWith(".tsx") && !f.includes(".test.") && e.name !== "classic.tsx" && !/Invoice|print/i.test(f)) o.push(f);
  }
  return o;
};

function measure(srcDir) {
  let staticDecl = 0, thNum = 0, colClass = 0;
  const widths = new Set();
  let cardCopies = 0;
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, "utf8");
    colClass += (text.match(/erp-col-(xxs|xs|s|m|l|xl|xxl|w|xw)\b/g) ?? []).length;
    if (/padding: "28px 20px"|padding: "32px 20px"/.test(text)) cardCopies += 1;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    (function visit(n) {
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName)) {
        const st = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.text === "style");
        if (st?.initializer && ts.isJsxExpression(st.initializer) && st.initializer.expression && ts.isObjectLiteralExpression(st.initializer.expression)) {
          for (const p of st.initializer.expression.properties) {
            if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
            if (!(ts.isNumericLiteral(p.initializer) || ts.isStringLiteral(p.initializer))) continue;
            staticDecl++;
            if (p.name.text === "width" && ts.isNumericLiteral(p.initializer)) {
              widths.add(p.initializer.text);
              if (["th", "col"].includes(n.tagName.text)) thNum++;
            }
          }
        }
      }
      ts.forEachChild(n, visit);
    })(sf);
  }
  const cssPath = path.join(srcDir, "app", "erp-theme.css");
  return { staticDecl, thNum, colClass, distinctWidths: widths.size, cardCopies, cssLines: readFileSync(cssPath, "utf8").split("\n").length };
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "base-"));
try {
  execFileSync("git", ["worktree", "add", "-f", "--detach", tmp, base], { cwd: repo, stdio: "ignore" });
  const before = measure(path.join(tmp, "src"));
  const now = measure(path.join(repo, "src"));
  const statSrc = execFileSync("git", ["diff", "--shortstat", base, "HEAD", "--", "src"], { cwd: repo }).toString().trim();
  const statAll = execFileSync("git", ["diff", "--shortstat", base, "HEAD"], { cwd: repo }).toString().trim();
  const budgetNow = JSON.parse(readFileSync(path.join(repo, "scripts/inline-style-budget.json"), "utf8"));
  const budgetThen = JSON.parse(execFileSync("git", ["show", `${base}:scripts/inline-style-budget.json`], { cwd: repo }).toString());
  const sum = (b) => b.spacing + b.font + b["color-border"] + b.layout + b.size + b.other + b.mappable;
  const row = (name, a, b, unit = "") => {
    const d = b - a;
    const pct = a ? `${d > 0 ? "+" : ""}${Math.round((d / a) * 100)}%` : "-";
    return `| ${name} | ${a}${unit} | ${b}${unit} | ${d > 0 ? "+" : ""}${d}${unit} (${pct}) |`;
  };
  console.log(`## 정비 성과표 (기준: ${base} → 지금)\n`);
  console.log("| 항목 | 시작 | 지금 | 변화 |\n|---|---|---|---|");
  console.log(row("화면 코드에 직접 박은 값(style 정적 선언)", before.staticDecl, now.staticDecl));
  console.log(row("표 머리·열에 숫자로 박은 폭", before.thNum, now.thNum));
  console.log(row("표 열 폭에 쓰인 서로 다른 숫자 값", before.distinctWidths, now.distinctWidths));
  console.log(row("열 폭 단계 클래스(erp-col-*) 사용", before.colClass, now.colClass));
  console.log(row("인라인 스타일 검사 기준선 합계", sum(budgetThen), sum(budgetNow)));
  console.log(row("상태 카드(오류·404 등) 복붙 파일", before.cardCopies, now.cardCopies));
  console.log(row("erp-theme.css 줄 수", before.cssLines, now.cssLines));
  console.log(`\n변형 규모 — 앱 코드(src)만: ${statSrc || "변경 없음"}`);
  console.log(`변형 규모 — 전체(설계 문서·시안·검사 포함): ${statAll || "변경 없음"}`);
  console.log("\n※ 측정 대상: 클래식 동결본·인쇄 서식 제외한 화면 코드(.tsx). 같은 방법으로 시작/지금을 잼.");
} finally {
  try { execFileSync("git", ["worktree", "remove", "--force", tmp], { cwd: repo, stdio: "ignore" }); } catch {}
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
}
