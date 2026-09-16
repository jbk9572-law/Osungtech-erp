#!/usr/bin/env node
// 2026-08-15(bfc3d6e)에서 상세화면 툴바 순서를 "수정/기타 동작 → 삭제 →
// ESC 닫기(맨 오른쪽)"로 통일했는데, 그 이후 새로 만든 화면 중 일부
// (todos/[id], announcements/[id], reports/payment-requests/[id])가
// "ESC 닫기"를 툴바 맨 앞에 두고 그 뒤에 수정/삭제 버튼을 이어붙인 반대
// 순서로 작성됐다 — 다른 상세화면과 시각적으로 어긋나 보이는 원인이다.
// 이런 실수가 새 화면을 추가할 때마다 반복될 수 있어(사람이 매번 다른
// 화면과 비교해봐야 알 수 있는 종류), erp-toolbar 안에서 danger 버튼
// (ESC/닫기/취소) 뒤에 다른 동작 버튼이 오면 커밋 시점에 자동으로
// 잡아낸다.
//
// 검사 방법: "erp-toolbar" 클래스가 붙은 div 블록을 태그 깊이를 세어
// 통째로 추출한 뒤, 그 안에서 "erp-btn-danger" 클래스가 붙은 첫 버튼/
// 링크의 끝 위치보다 뒤에 다른 동작 요소(Link/button/DeleteButton/
// PrintInPlaceButton)가 나오면 위반으로 본다. danger 버튼이 툴바에
// 하나뿐이고 그게 맨 마지막이면 통과, 앞이나 중간에 있으면 위반.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src", "app", "(dashboard)");

// "파일경로:몇 번째 erp-toolbar 블록" 형태로 추가하고 이유를 적을 것.
// (예: 툴바 안에 danger 버튼이 2개 이상이라 이 검사가 오탐하는 경우)
const ALLOWLIST = new Set([]);

const ACTION_TAG_RE = /<(Link|button|DeleteButton|PrintInPlaceButton)\b/g;

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// text[start]가 "<div" 여는 태그의 시작이라고 가정하고, 태그 깊이를 세어
// 짝이 맞는 "</div>"까지의 전체 블록(여는 태그 포함)을 잘라 반환한다.
function extractDivBlock(text, start) {
  const divOpenRe = /<div\b/g;
  const divCloseRe = /<\/div>/g;
  divOpenRe.lastIndex = start;
  divCloseRe.lastIndex = start;
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const nextOpen = text.indexOf("<div", i);
    const nextClose = text.indexOf("</div>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
      if (depth === 0) return text.slice(start, i);
    }
  }
  return null;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  let searchFrom = 0;
  let blockIndex = 0;
  for (;;) {
    const marker = 'className="erp-toolbar"';
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const divStart = text.lastIndexOf("<div", idx);
    searchFrom = idx + marker.length;
    if (divStart === -1) continue;
    const block = extractDivBlock(text, divStart);
    blockIndex += 1;
    if (!block) continue;

    const key = `${relPath}:${blockIndex}`;
    if (ALLOWLIST.has(key)) continue;

    // 블록 안의 danger 버튼(ESC/닫기/취소) 시작 위치들을 모두 찾는다.
    const dangerRe = /<(Link|button)\b[^>]*erp-btn-danger/g;
    let dangerMatch;
    let firstDangerStart = -1;
    let dangerCount = 0;
    while ((dangerMatch = dangerRe.exec(block))) {
      dangerCount += 1;
      if (firstDangerStart === -1) firstDangerStart = dangerMatch.index;
    }
    if (firstDangerStart === -1 || dangerCount !== 1) continue; // danger 없음/여러 개면 판단 보류

    // 그 danger 버튼 태그 자체가 끝나는 위치(다음 '>' 까지)를 찾는다.
    const dangerTagEnd = block.indexOf(">", firstDangerStart);
    if (dangerTagEnd === -1) continue;

    // danger 버튼 이후에 다른 동작 요소(Link/button/DeleteButton/
    // PrintInPlaceButton)가 또 나오면, ESC가 맨 마지막이 아니라는 뜻이다.
    ACTION_TAG_RE.lastIndex = dangerTagEnd;
    const nextActionMatch = ACTION_TAG_RE.exec(block);
    if (nextActionMatch) {
      violations.push({ key, filePath: relPath });
    }
  }

  return violations;
}

const files = walkDir(SRC_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error(
    "erp-toolbar 안 ESC/닫기 버튼 위치 위반 발견 (ESC는 항상 툴바 맨 마지막에 와야 함, 2026-08-15 bfc3d6e 컨벤션):\n"
  );
  for (const v of violations) {
    console.error(`  ${v.key}  — ESC(danger) 버튼 뒤에 다른 동작 버튼이 있음`);
  }
  console.error(
    "\nESC/닫기/취소 버튼을 툴바의 마지막 자식으로 옮기세요 (수정/삭제/인쇄 등 동작 버튼이 먼저, ESC가 맨 뒤)."
  );
  console.error(
    "정말 예외가 필요하면 scripts/check-toolbar-esc-order.mjs의 ALLOWLIST에 이유와 함께 추가하세요."
  );
  process.exit(1);
} else {
  console.log(`툴바 ESC 버튼 위치 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
