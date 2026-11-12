#!/usr/bin/env node
// 접근성 기본기(스크린리더·키보드 사용자)를 자동으로 지키는 래칫 검사. 접근성 점수가 가장 낮았던 영역이라
// 새로 늘어나지 못하게 막고, 정리해서 줄이면 기준선(a11y-baseline.json)도 같이 낮춘다.
//  - img-alt: <img>에 alt가 없음
//  - icon-button-name: 글자 없이 기호/이모지만 있는 <button>에 aria-label/title이 없음(✕, ＋, 🗑 등)
//  - control-name: <input>/<select>/<textarea>에 id/aria-label/aria-labelledby/title/placeholder 중
//    아무것도 없음(hidden/checkbox/radio/file/submit/button 제외) — 라벨과 연결할 방법이 없는 입력칸
import ts from "typescript";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "src");
const BASELINE = path.join(here, "a11y-baseline.json");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") && !full.includes(".test.")) out.push(full);
  }
  return out;
}
const attrNames = (el) => new Set(el.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.text));
const attrStr = (el, name) => {
  const a = el.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.text === name);
  return a?.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : null;
};
const hasSpread = (el) => el.attributes.properties.some(ts.isJsxSpreadAttribute);

const counts = { "img-alt": 0, "icon-button-name": 0, "control-name": 0 };
const samples = { "img-alt": [], "icon-button-name": [], "control-name": [] };
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const note = (rule, node) => {
    counts[rule] += 1;
    if (samples[rule].length < 5) samples[rule].push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
  };
  (function visit(node) {
    const el = ts.isJsxSelfClosingElement(node) ? node : ts.isJsxElement(node) ? node.openingElement : null;
    if (el && ts.isIdentifier(el.tagName)) {
      const tag = el.tagName.text;
      const names = attrNames(el);
      if (tag === "img" && !names.has("alt") && !hasSpread(el)) note("img-alt", el);
      if (tag === "button" && ts.isJsxElement(node) && !names.has("aria-label") && !names.has("title") && !names.has("aria-labelledby") && !hasSpread(el)) {
        const kids = node.children.filter((c) => !(ts.isJsxText(c) && !c.text.trim()));
        if (kids.length === 1 && ts.isJsxText(kids[0])) {
          const text = kids[0].text.trim();
          // 글자(한글/영문/숫자)가 하나도 없는 기호·이모지 전용 버튼
          if (text && !/[\p{L}\p{N}]/u.test(text.replace(/\p{Extended_Pictographic}/gu, ""))) note("icon-button-name", el);
        }
      }
      if (tag === "input" || tag === "select" || tag === "textarea") {
        const type = attrStr(el, "type");
        if (!(tag === "input" && ["hidden", "checkbox", "radio", "file", "submit", "button", "image", "reset"].includes(type ?? "")) &&
            !["id", "aria-label", "aria-labelledby", "title", "placeholder"].some((n) => names.has(n)) && !hasSpread(el)) note("control-name", el);
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
}

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log("기준선 기록:", JSON.stringify(counts));
  process.exit(0);
}
const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const worse = [], better = [];
for (const k of Object.keys(counts)) {
  if (counts[k] > (base[k] ?? 0)) worse.push(`${k}: ${counts[k]}개 (기준선 ${base[k] ?? 0}) 예: ${samples[k].join(", ")}`);
  else if (counts[k] < (base[k] ?? 0)) better.push(`${k}: ${base[k]} → ${counts[k]}`);
}
if (worse.length) {
  console.error("접근성 기본 검사 실패:\n" + worse.map((w) => "  - " + w).join("\n") +
    "\n\nimg에는 alt, 기호 전용 버튼에는 aria-label, 입력칸에는 label(id 연결)/aria-label을 주세요.");
  process.exit(1);
}
if (better.length) {
  console.error("정리로 줄었습니다. 기준선을 낮추세요(node scripts/check-a11y-basics.mjs --write):\n" + better.map((b) => "  - " + b).join("\n"));
  process.exit(1);
}
console.log(`접근성 기본 검사 통과 (${JSON.stringify(counts)})`);
