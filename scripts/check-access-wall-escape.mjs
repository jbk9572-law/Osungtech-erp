#!/usr/bin/env node
// AccessWall이 페이지 전체를 대신 그리는 조기 반환(`if (차단) return
// <AccessWall .../>`) 패턴에서는, 그 페이지의 정상 렌더 경로에 있던
// <KeyboardShortcuts>까지 같이 건너뛰어서 ESC 단축키가 아예 등록되지
// 않는 버그가 있었다(사용자가 실제로 겪고 지적: "ESC 매출상세로 키도
// 안먹음"). AccessWall에 backHref를 넘기면 내부적으로 KeyboardShortcuts를
// 같이 그려주게 고쳤는데, 새로 AccessWall을 쓰는 화면이 또 backHref를
// 빼먹기 쉬운 패턴이라(사람이 매번 다시 찾아야 하는 종류) 자동 검사로
// 못 박는다.
//
// 검사 방법: "<AccessWall" JSX 태그를 찾아서, 그 태그가 "/>"로 닫히는
// 지점까지의 속성 텍스트 안에 "backHref"가 있는지 확인한다.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src", "app", "(dashboard)");

const ALLOWLIST = new Set([]);

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

const files = walkDir(SRC_ROOT);
const violations = [];
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("<AccessWall")) continue;
  checked += 1;
  const rel = path.relative(path.join(__dirname, ".."), file);

  const tagRe = /<AccessWall\b/g;
  let match;
  while ((match = tagRe.exec(text))) {
    const start = match.index;
    const closeIdx = text.indexOf("/>", start);
    if (closeIdx === -1) continue;
    const tagText = text.slice(start, closeIdx);
    const lineNo = text.slice(0, start).split("\n").length;
    const key = `${rel}:${lineNo}`;
    if (ALLOWLIST.has(key)) continue;
    if (!tagText.includes("backHref")) {
      violations.push(key);
    }
  }
}

if (violations.length > 0) {
  console.error("AccessWall에 backHref가 빠져 있어 ESC 단축키가 안 먹는 곳 발견:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error("\n<AccessWall ... backHref=\"...\" />로 ESC로 돌아갈 경로를 지정하세요.");
  console.error("정말 backHref가 필요 없는 경우(이례적)라면 ALLOWLIST에 이유와 함께 추가하세요.");
  process.exit(1);
}

console.log(`AccessWall backHref 검사 통과 (검사한 파일 ${checked}개, 위반 없음)`);
