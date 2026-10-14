#!/usr/bin/env node
// 개발헌법 3번 반면교사 사례("박스 안의 박스") 재발 방지. 이번에 모달/
// 분할뷰 두 맥락에서 같은 버그(.erp-detail이 또 다른 테두리 있는 컨테이너
// 안에 중첩)를 손으로 찾다가, "메뉴별로 전부 다 체크한 거냐"는 지적을
// 받았다 — 사람이 매번 전체 화면을 손으로 훑어 확인하는 대신, 자기
// 테두리를 가진 "박스형" 클래스가 또 다른 박스형 클래스 안에 중첩되는
// 모든 경우를 코드베이스 전체에서 자동으로 찾는다.
//
// 검사 방법: erp-theme.css에서 자기 테두리(border)와 패널/서브틀 배경을
// 함께 선언한 "박스형" 클래스 중, 독립적인 카드/섹션으로 흔히 쓰이는
// 것들만 추려(BOX_CLASSES) JSX 트리를 훑는다. 그런 클래스를 가진 요소가
// 조상 중에 (같거나 다른) 박스형 클래스를 가진 요소를 또 가지고 있으면
// 위반으로 본다 — 단, .erp-modal-body/.erp-split-detail 안의 .erp-detail은
// 이미 erp-theme.css의 스코프 CSS(.erp-modal-body .erp-detail,
// .erp-split-detail .erp-detail)가 테두리를 지워서 실제로는 중첩 박스가
// 아니므로 예외로 둔다.
//
// 오탐이 있으면(정말 의도된 중첩이라면) ALLOWLIST에 "파일:줄번호"와
// 이유를 추가한다. 새로운 박스형 클래스를 CSS에 추가했는데 여기
// BOX_CLASSES에 없다면 추가해야 이 검사가 그 클래스도 커버한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

// 독립 카드/섹션으로 흔히 쓰이는 박스형 클래스만 추린다 — 폼 컨트롤류
// (erp-select, erp-btn, erp-date-preset-btn 등)는 "컨테이너"가 아니라서
// 뺀다.
const BOX_CLASSES = new Set([
  "erp-detail",
  "erp-split-detail",
  "erp-home-panel",
  "erp-hero-card",
  "erp-item-card",
  "erp-cat-sidebar",
  "erp-doc-paper",
]);

// .erp-modal-body/.erp-split-detail 안의 .erp-detail은 erp-theme.css의
// 스코프 CSS가 이미 테두리를 지워서 실제로는 박스가 아니다.
const CSS_NEUTRALIZED_PARENTS = new Set(["erp-modal-body", "erp-split-detail"]);

const ALLOWLIST = new Set([
  // 세금계산서 작성 폼의 "공급자/공급받는자" 박스는 실제 종이 세금계산서
  // 양식의 관례(나란히 놓인 두 박스)를 그대로 재현한 것 — 우연히 생긴
  // 중첩이 아니라 의도된 문서 서식이라 그대로 둔다.
  "src/components/tax-invoice-form.tsx:139",
  "src/components/tax-invoice-form.tsx:153",
  // .erp-detail 섹션 하나 안에 공정 단계를 한 줄씩 보여주는 카드 목록
  // (.erp-home-panel)이다 — 섹션을 또 감싸는 중복 박스가 아니라 목록
  // 항목(타임라인/체크리스트류)이라 성격이 다르다.
  "src/app/portal/(app)/assignments/[id]/page.tsx:71",
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

function getAttr(attributes, attrName) {
  return attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name && p.name.text === attrName,
  );
}

function classNameValue(attributes) {
  const attr = getAttr(attributes, "className");
  if (!attr || !attr.initializer) return "";
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    // 조건식/템플릿 리터럴은 소스 텍스트 그대로 합쳐서 패턴 매칭용으로만 쓴다.
    return attr.initializer.expression.getText();
  }
  return "";
}

function boxClassesOf(classNameStr) {
  const tokens = classNameStr.split(/[\s"'`]+/);
  return tokens.filter((t) => BOX_CLASSES.has(t) || CSS_NEUTRALIZED_PARENTS.has(t));
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  // 조상 스택: 각 항목은 { boxClass, isNeutralizingParent } — 지금까지
  // 내려오면서 만난 박스형/중화 클래스들.
  function visit(node, ancestorBoxStack) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const classNameStr = classNameValue(opening.attributes);
      const found = boxClassesOf(classNameStr);

      for (const cls of found) {
        if (BOX_CLASSES.has(cls)) {
          // 조상 중에 "중화 부모"(erp-modal-body/erp-split-detail)가 있고
          // 이 요소가 erp-detail이면 CSS가 이미 처리하므로 건너뛴다.
          const nearestNeutralizer = [...ancestorBoxStack].reverse().find((a) => CSS_NEUTRALIZED_PARENTS.has(a.cls));
          const neutralizedByParent = cls === "erp-detail" && nearestNeutralizer !== undefined;
          if (!neutralizedByParent) {
            const ancestorBox = ancestorBoxStack.find((a) => BOX_CLASSES.has(a.cls));
            if (ancestorBox) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              const key = `${relPath}:${line + 1}`;
              if (!ALLOWLIST.has(key)) {
                violations.push({ key, inner: cls, outer: ancestorBox.cls });
              }
            }
          }
        }
      }

      const nextStack = [...ancestorBoxStack, ...found.map((cls) => ({ cls }))];
      ts.forEachChild(node, (child) => visit(child, nextStack));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, ancestorBoxStack));
  }

  visit(sourceFile, []);
  return violations;
}

const files = walkDir(SRC_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error("박스형 컨테이너가 또 다른 박스형 컨테이너 안에 중첩된 곳 발견(\"박스 안의 박스\"):\n");
  for (const { key, inner, outer } of violations) {
    console.error(`  ${key}  — .${outer} 안에 .${inner}`);
  }
  console.error(
    "\n안쪽 요소의 테두리/배경을 없애거나(.erp-modal-body .erp-detail처럼 스코프 CSS로), 바깥 박스를 없애세요.",
  );
  console.error(
    "정말 의도된 중첩이라면 scripts/check-nested-boxed-container.mjs의 ALLOWLIST에 이유와 함께 추가하세요.",
  );
  process.exit(1);
} else {
  console.log(`박스 중첩 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
