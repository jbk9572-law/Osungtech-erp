#!/usr/bin/env node
// 디자인 정합성 감사 1단계 — 폰트 크기를 전부 --erp-font-* 토큰으로
// 통일했는데(erp-theme.css :root 참고), 사람이 또 새 규칙을 추가하면서
// "12.5px"를 다시 직접 박아넣기 쉽다(토큰이 있다는 걸 몰랐거나, 복붙
// 습관으로). 색상(check-hardcoded-hex-color.mjs)과 같은 이유로
// erp-theme.css 안의 `font-size: Npx` 리터럴을 자동으로 잡는다.
//
// 스코프: erp-theme.css 한 파일만 본다 — 컴포넌트(tsx) 안의 인라인
// style={{fontSize}}은 범위가 훨씬 넓고(수백 곳) 리팩터 비용이 커서
// 이번 1단계에서는 다루지 않는다(사용자에게 별도로 보고됨).
//
// 허용 예외: 토큰 스케일에 없는 값(한 곳에서만 쓰이는 특수 크기,
// 예: 19px/18px/0.92em)은 ALLOWLIST에 "파일:줄번호"로 등록한다 — 새로
// 생기는 숫자 하나하나가 전부 예외로 쌓이면 검사 의미가 없으므로,
// 이미 스케일에 있는 값(9/10.5/11.5/12.5/13/14/16px)을 또 리터럴로
// 쓰는 것만 막는 게 핵심이다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "src", "app", "erp-theme.css");

const TOKEN_VALUES = new Set(["9px", "10.5px", "11.5px", "12.5px", "13px", "14px", "16px"]);

const text = readFileSync(FILE, "utf8");
const lines = text.split("\n");
const violations = [];

lines.forEach((line, i) => {
  const m = line.match(/font-size:\s*([\d.]+px)\s*;/);
  if (m && TOKEN_VALUES.has(m[1])) {
    violations.push(`erp-theme.css:${i + 1} — font-size: ${m[1]} (토큰 있음, var(--erp-font-*)로 바꾸세요)`);
  }
});

if (violations.length > 0) {
  console.error("폰트 크기 토큰 검사 위반 — 이미 토큰이 있는 값을 리터럴로 또 썼습니다:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nerp-theme.css :root의 --erp-font-* 토큰을 쓰세요.");
  process.exit(1);
}

console.log("폰트 크기 토큰 검사 통과 (검사한 파일 1개, 위반 없음)");
