#!/usr/bin/env node
// 화면 상단에 "이 화면 사용법"을 설명하는 안내 문구는 PageGuide
// 컴포넌트로 박스화하기로 정했는데, 그때그때 눈에 띈 것만 손으로 고치다
// 보니 스타일만 다르고 똑같이 안내문인 문구를 계속 놓쳤다(예: QR
// 자동실사 스캐너 하단 안내문 — className이 조금 달라서 이전 사람 손
// 검색에 안 걸렸다). 사람이 매번 다시 찾아야 하는 패턴이라 자동 검사로
// 못 박는다.
//
// 검사 방법: 흐린 보조 텍스트 색(--erp-text-muted 등) + 작은 글씨
// (text-xs 계열) 조합으로 스타일링된 <p>/<div>/<span> 중, 안에 든
// 텍스트가 길고(20자 이상) 한국어 안내문 어미("세요"/"니다"/"함")로
// 끝나는 걸 찾는다 — 짧은 라벨/캡션(날짜, SKU, 담당자명 등)은 이 조건에
// 안 걸린다.
//
// 오탐이 있으면(정말 캡션이지 안내문이 아니라면) ALLOWLIST에
// "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([
  // 데이터 캡션(주문일자, SKU, 담당자명 등)이라 안내문이 아님 — 헌법검사
  // 사이클에서 이미 검토 완료.
  "src/app/(dashboard)/sales/[id]/page.tsx:146",
  "src/app/(dashboard)/purchases/[id]/page.tsx:139",
  "src/app/(dashboard)/customers/[id]/page.tsx:88",
  "src/app/(dashboard)/suppliers/[id]/page.tsx:88",
  "src/app/(dashboard)/products/[id]/page.tsx:60",
  "src/app/(dashboard)/inventory/[productId]/page.tsx:145",
  "src/app/(dashboard)/settings/company/page.tsx:38",
  "src/app/(dashboard)/settings/password/page.tsx:15",
  // .erp-new-count-cta 자체가 이미 점선 테두리 있는 카드형 콜아웃이라,
  // 안에서 또 PageGuide로 박스 안의 박스를 만들면 오히려 더 지저분해짐.
  "src/components/inventory-count-form.tsx:144",
]);

const MUTED_COLOR = /erp-text-muted/;
const SMALL_TEXT_CLASS = /text-xs|text-\[1[01]px\]|fontSize:\s*1[0-3]/;
const SENTENCE_ENDING = /(세요|니다|함|됨)[.)]?\s*$/;
const MIN_LENGTH = 20;

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
  if (!attr || !attr.initializer) return "";
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    // 템플릿 리터럴/조건식 등은 소스 텍스트 그대로 합쳐서 패턴 매칭용으로만 쓴다.
    return attr.initializer.expression.getText();
  }
  return "";
}

// 태그 자체(className/style)가 "흐린 작은 보조 텍스트" 스타일인지 —
// PageGuide 내부 <p>는 --erp-info-* 변수를 쓰므로 여기 안 걸린다.
function looksLikeMutedSmallText(attributes) {
  const classValue = attrStringValue(getAttr(attributes, "className"));
  const styleValue = attrStringValue(getAttr(attributes, "style"));
  const combined = `${classValue} ${styleValue}`;
  return MUTED_COLOR.test(combined) && SMALL_TEXT_CLASS.test(combined);
}

// JSX 자식 중 순수 텍스트 노드만 이어붙인다 — {변수} 보간이 섞인 곳은
// 안내문이라기보다 데이터 표시일 가능성이 높아 텍스트 길이 판정에서
// 자연히 짧게 잡혀 걸러진다.
function collectStaticText(children) {
  let text = "";
  for (const child of children) {
    if (ts.isJsxText(child)) {
      text += child.text.replace(/\s+/g, " ");
    }
  }
  return text.trim();
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName;
      if (ts.isIdentifier(tagName) && ["p", "div", "span"].includes(tagName.text)) {
        if (looksLikeMutedSmallText(node.openingElement.attributes)) {
          const staticText = collectStaticText(node.children);
          if (staticText.length >= MIN_LENGTH && SENTENCE_ENDING.test(staticText)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const key = `${relPath}:${line + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push({ key, snippet: staticText.slice(0, 40) });
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
  console.error("PageGuide로 박스화 안 된 안내 문구 발견:\n");
  for (const { key, snippet } of violations) {
    console.error(`  ${key}  — "${snippet}..."`);
  }
  console.error(
    "\n화면 사용법을 설명하는 안내 문구는 <PageGuide>로 감싸 박스화하세요 (src/components/erp/page-guide.tsx).",
  );
  console.error(
    "데이터 캡션이라 안내문이 아니라면 scripts/check-page-guide.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`PageGuide 박스화 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
