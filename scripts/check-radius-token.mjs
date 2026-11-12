#!/usr/bin/env node
// 개발헌법 3번("모서리 반경 같은 값은 전부 CSS 변수로만 쓴다")에 따라
// 모서리 반경(border-radius)도 --erp-radius-* 토큰으로 통일했다
// (erp-theme.css :root/[data-theme="soft"] 참고) — 클래식 테마는
// 토큰이 0, Soft 테마에서만 실제 값이 된다.
//
// 이 토큰화 이전에는 "클래식은 그대로 두고 모던 전용 블록에 클래스
// 이름을 하나씩 나열해서 radius를 덮어쓰는" 허용목록 방식이었는데,
// 새 박스형 컴포넌트가 생기거나 기존 박스에 flush 머리글 같은 자식이
// 추가될 때 그 목록에 추가하는 걸 사람이 잊기 쉬워서 실제로 세 번
// 연속(.erp-split-list 등 → .erp-home-panel-title/.erp-richtext 등)
// 빠뜨린 전례가 있다(사용자 지적 — "자꾸 빵꾸나거나 언밸런스한
// 부분들이 많아"). 토큰화 이후에도 사람이 새 규칙을 추가하면서 토큰을
// 안 쓰고 radius 선언 자체를 깜빡할 수 있으니, 그 실수를 자동으로
// 잡는다.
//
// 검사 방법: erp-theme.css + globals.css의 모든 규칙을 훑어서, "테두리와 배경이 둘 다
// 있는(=화면에 박스처럼 보이는)" 규칙인데 border-radius류 선언이 아예
// 없는 경우를 위반으로 잡는다. border: none/transparent나
// background: none/transparent만 있는 경우는 박스가 아니므로 제외한다.
//
// 예외(EXEMPT_SELECTORS, 이유를 각각 명시): 화면 가장자리에 변까지
// 붙는 바(리본/트리메뉴/상태바/전체공지 배너 등)는 둥글릴 자리 자체가
// 없어 의도적으로 각지다. 표 셀/구분선처럼 테두리가 한쪽 면(border-
// bottom 등)만 있는 "칸막이"도 박스가 아니다. 이미 둥글고
// overflow: hidden인 부모 안의 flush 머리글은 부모가 알아서 모서리를
// 잘라주므로 따로 radius가 필요 없다.
//
// 오탐이 있으면 EXEMPT_SELECTORS에 이유와 함께 추가한다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// erp-theme.css가 메인 디자인 시스템이지만, .erp-spinner처럼 .erp 테마
// 래퍼 밖(로그인/회원가입 등)에서도 쓰는 극소수 클래스는 globals.css에
// 따로 있다 — 거기도 박스형 클래스가 생길 수 있으니 같이 본다.
const FILES = [
  path.join(__dirname, "..", "src", "app", "erp-theme.css"),
  path.join(__dirname, "..", "src", "app", "globals.css"),
];

const EXEMPT_SELECTORS = new Set([
  ".erp-demo-banner", // 화면 맨 위 가장자리에 변까지 붙는 전체 폭 배너
  ".erp-quota-banner-warn", // 위와 같은 자리(데모 배너와 동일 위치)의 쿼터 경고 배너
  ".erp-quota-banner-danger", // 위와 같은 자리의 쿼터 위험 배너
  ".erp-platform-announcement-banner", // 위와 같은 자리의 플랫폼 전체공지 배너(LED 전광판 스타일)
  ".erp-ribbon", // 타이틀바 바로 아래, 화면 가로 전체에 붙는 리본 바
  ".erp-tree", // 화면 왼쪽 가장자리에 세로로 붙는 트리메뉴
  ".erp-tree-usage", // 트리메뉴 안쪽 사용량 표시 — 트리와 같은 가장자리 톤
  ".erp-tree-toggle", // 트리메뉴 접기 버튼 — 트리 가장자리에 붙음
  ".erp-statusbar", // 화면 맨 아래 가장자리에 붙는 상태바
  ".erp-grid thead th", // 표 헤더 셀 — border-bottom 한 줄만 있는 칸막이, 박스 아님
  ".erp-doc-header-label", // 문서 라벨/값 2열 표의 라벨 칸 — border-right 한 줄만 있는 칸막이
  ".erp-bell-section-title", // 알림 드롭다운 안의 구분선 머리글(border-bottom만) — 드롭다운 자체가 둥글게 처리됨
  ".erp-messenger-roster-head", // 사원목록 패널 안의 flush 머리글 — 부모(.erp-cat-sidebar)가 의도적으로 각진 사이드바라 머리글도 그대로
  ".erp-split-list-head", // .erp-split-list가 이미 border-radius 토큰 + overflow: hidden이라 부모가 모서리를 잘라줌
  ".erp-key-hint kbd", // 키보드 키캡 표시 — 클래식/모던 공통으로 늘 각진 디자인으로 둠(의도적, 테마 무관)
  ".erp-cat-sidebar", // 좌측 카테고리 사이드바 — .erp-tree와 같은 "내비게이션 레일" 취급으로 의도적으로 각짐
]);

// 주석 제거 — 주석 안의 설명 문장이 셀렉터/선언으로 잘못 파싱되는 걸 막는다.
const sources = FILES.map((file) => ({
  file,
  stripped: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
}));

/**
 * 중괄호 깊이를 추적하며 "리프 규칙"(더 이상 중첩 블록이 없는 선언
 * 블록)만 모은다 — @media 안에 있어도 그 안의 개별 규칙은 그대로 리프로
 * 잡힌다(선택자만 보고 판단하므로 @media 래퍼 자체는 무시해도 무방).
 */
function collectLeafRules(src) {
  const rules = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === "{") {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      const body = src.slice(i + 1, j - 1);
      const selStart = src.lastIndexOf("}", i - 1) + 1;
      const selector = src.slice(selStart, i).trim();
      // body 안에 또 {가 있으면(중첩 @media/선택자) 리프가 아니다 —
      // 그 안쪽만 재귀적으로 다시 수집한다.
      if (body.includes("{")) {
        rules.push(...collectLeafRules(body));
      } else if (selector && !selector.startsWith("@") && !selector.startsWith(":root")) {
        rules.push({ selector, body });
      }
      i = j;
    } else {
      i++;
    }
  }
  return rules;
}

function hasRealValue(body, prop) {
  const re = new RegExp(`(?:^|[\\s;{])${prop}\\s*:\\s*([^;]+);`, "g");
  let m;
  while ((m = re.exec(body))) {
    const v = m[1].trim().toLowerCase();
    if (v !== "none" && v !== "0" && v !== "transparent") return true;
  }
  return false;
}

function hasBorder(body) {
  return (
    hasRealValue(body, "border") ||
    hasRealValue(body, "border-top") ||
    hasRealValue(body, "border-right") ||
    hasRealValue(body, "border-bottom") ||
    hasRealValue(body, "border-left")
  );
}

function hasBackground(body) {
  return hasRealValue(body, "background") || hasRealValue(body, "background-color");
}

function hasRadius(body) {
  return /radius\s*:/.test(body);
}

// 파일 전체(erp-theme.css + globals.css)를 한 묶음으로 보고 교차
// 참조한다 — 두 파일에 걸쳐 같은 클래스가 나뉘어 선언되는 경우는 없지만
// 안전하게 합쳐서 본다.
const rules = sources.flatMap(({ file, stripped }) =>
  collectLeafRules(stripped).map((r) => ({ ...r, file })),
);

// 클래스 이름 → 그 클래스가 (다른 선택자에서라도) radius를 받는지.
// ".foo.active { ... }"처럼 상태 변형 선택자는 기본 ".foo" 규칙에서
// 이미 radius를 상속하므로 그 자체로는 radius 선언이 없어도 위반이
// 아니다.
const radiusClasses = new Set();
for (const { selector, body } of rules) {
  if (!hasRadius(body)) continue;
  for (const cls of selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    radiusClasses.add(cls[1]);
  }
}

const violations = [];
for (const { selector, body, file } of rules) {
  if (!hasBorder(body) || !hasBackground(body)) continue;
  if (hasRadius(body)) continue;
  const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  if (classes.some((c) => radiusClasses.has(c))) continue;
  // 쉼표로 묶인 여러 선택자 중 하나라도 예외 목록에 있으면 전체를 건너뛴다.
  const parts = selector.split(",").map((s) => s.trim());
  if (parts.some((p) => EXEMPT_SELECTORS.has(p))) continue;
  violations.push(`${path.basename(file)}: ${selector.replace(/\s+/g, " ")}`);
}

if (violations.length > 0) {
  console.error(
    "모서리 반경(r값) 토큰 검사 위반 — 테두리+배경이 있는 박스형 규칙인데 border-radius류 선언이 없습니다:\n",
  );
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\n새 박스형 컴포넌트라면 역할에 맞는 border-radius: var(--erp-radius-*, <클래식값>) 토큰을 기본 규칙에 추가하세요" +
      "(erp-theme.css :root의 --erp-radius-* 주석 참고). 의도적으로 각진 가장자리 바/칸막이라면" +
      " scripts/check-radius-token.mjs의 EXEMPT_SELECTORS에 이유와 함께 추가하세요.",
  );
  process.exit(1);
}

console.log(`모서리 반경(r값) 토큰 검사 통과 (검사한 규칙 ${rules.length}개, 위반 없음)`);
