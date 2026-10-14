#!/usr/bin/env node
// 개발헌법 3번(디자인/기능 100% 모듈화)에 따라, info/warning/danger/success
// 톤 박스(배경+글자색+테두리를 같은 톤 변수 3개로 맞춘 것)를 PageGuide
// 컴포넌트 없이 인라인 style로 다시 조립하는 걸 자동으로 잡는다. 헌법검사
// 중 이 패턴이 20개 넘는 파일에 복붙돼 있던 걸 한 번에 PageGuide로
// 통합했는데, 손으로 또 새로 생기면 똑같은 걸 또 찾아야 하니 자동화한다.
//
// 검사 방법: <p>/<div>/<span>의 style에 background: var(--erp-X-bg),
// color: var(--erp-X) 계열, border: ...var(--erp-X-border)...가 같은
// 톤(X) 세 가지 다 같이 있으면 PageGuide의 시각적 쉘을 그대로 복제한
// 것으로 보고 위반으로 잡는다 — 셋 중 하나라도 빠지면(예: 배경+테두리만
// 있고 글자색은 다른 곳에, 또는 칩처럼 작은 배지) 안내 박스가 아니라
// 다른 용도(편집 가능한 행, 칩, 배지)일 가능성이 높아 대상에서 뺀다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([
  // 거래처 선택 후 "특이사항"을 보여주는 레코드별 인라인 노트다 — 화면
  // 사용법을 설명하는 PageGuide 성격이 아니고, radius:0 네모 처리가
  // 의도적(다른 PageGuide 박스는 둥근 모서리)이라 그대로 둔다.
  "src/components/party-search-select.tsx:101",
  // 매입처 미지정 품목을 표시하는 작은 칩(margin:4, radius:0)이다 —
  // 페이지 안내문이 아니라 목록 행 안의 상태 배지라 PageGuide 대상이 아님.
  "src/app/(dashboard)/inventory/reorder-suggestions/page.tsx:141",
  // 품목 그리드 한 행 안에서 그 거래처별 특이사항을 보여주는 행 단위
  // 인라인 노트(fontSize 11.5, radius:0) — party-search-select.tsx의
  // 특이사항 노트와 같은 성격이라 PageGuide(페이지 레벨 안내) 대상이 아님.
  "src/components/new-purchase-form.tsx:1792",
  "src/components/new-sale-form.tsx:1801",
  // 역할 변경을 확인/취소하는 작은 인라인 칩(rounded-sm px-2 py-1,
  // inline-flex + 취소 버튼) — 페이지 안내문이 아니라 행 안의 확인 배지.
  "src/components/user-role-select.tsx:70",
]);

const TONE_BG = {
  info: /var\(--erp-info-bg\)/,
  warning: /var\(--erp-warning-bg\)/,
  danger: /var\(--erp-danger-bg\)/,
  success: /var\(--erp-success-bg\)/,
};
const TONE_COLOR = {
  info: /var\(--erp-info-text\)/,
  warning: /var\(--erp-warning\)(?!-)/,
  danger: /var\(--erp-danger\)(?!-)/,
  success: /var\(--erp-success\)(?!-)/,
};
const TONE_BORDER = {
  info: /var\(--erp-info-border\)/,
  warning: /var\(--erp-warning-border\)/,
  danger: /var\(--erp-danger-border\)/,
  success: /var\(--erp-success-border\)/,
};

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

function styleText(attributes) {
  const attr = getAttr(attributes, "style");
  if (!attr || !attr.initializer) return "";
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return attr.initializer.expression.getText();
  }
  return "";
}

// 같은 톤의 background+color+border가 다 같이 들어있는지 본다.
function matchedTone(style) {
  for (const tone of Object.keys(TONE_BG)) {
    if (TONE_BG[tone].test(style) && TONE_COLOR[tone].test(style) && TONE_BORDER[tone].test(style)) {
      return tone;
    }
  }
  return null;
}

function checkFile(filePath) {
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  if (relPath === path.join("src", "components", "erp", "page-guide.tsx")) return [];

  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = opening.tagName;
      if (ts.isIdentifier(tagName) && ["p", "div", "span"].includes(tagName.text)) {
        const style = styleText(opening.attributes);
        const tone = style ? matchedTone(style) : null;
        if (tone) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const key = `${relPath}:${line + 1}`;
          if (!ALLOWLIST.has(key)) {
            violations.push({ key, tone });
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
  console.error("PageGuide 없이 톤 박스(배경+글자색+테두리)를 인라인 style로 다시 조립한 곳 발견:\n");
  for (const { key, tone } of violations) {
    console.error(`  ${key}  — tone=${tone}`);
  }
  console.error(
    "\n<PageGuide tone=\"...\">로 교체하세요 (src/components/erp/page-guide.tsx).",
  );
  console.error(
    "안내 박스가 아니라 다른 용도(배지/칩/편집행 등)라면 scripts/check-inline-tone-banner.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`톤 박스 중복 조립 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
