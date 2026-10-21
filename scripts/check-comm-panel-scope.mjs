#!/usr/bin/env node
// 공지사항/인사문서함/공문함/기안함처럼 "커뮤니케이션 서피스" 디자인
// (둥근 모서리/그림자, .erp-detail·.erp-post-* 내부 요소)을 쓰는 상세
// 패널 컴포넌트는, 목록 화면(각자 page.tsx에 .erp-comm-shell이 이미
// 있음) 안에서는 둥글게 보이다가, 게시판에서 글 제목을 눌러 들어가는
// /announcements/[id]·/hr/documents/item/[id]·/official-documents/[id]·
// /approvals/[id] 같은 "그 패널 하나만 그리는" 단독 페이지에서는
// .erp-comm-shell 래퍼를 깜빡 빼먹어서 똑같은 글인데 디자인이 갑자기
// 각지게 보이는 버그가 났었다(사용자 지적 — "게시판에서 제목클릭하면
// 본문으로 넘어가면 거긴 또 디자인언어가 다르네"). 네 곳에서 전부
// 똑같은 실수였고, 다섯 번째 단독 상세 페이지가 또 생기면 또 빠뜨릴 수
// 있는 패턴이라 자동 검사로 못 박는다.
//
// 검사 방법: 아래 COMM_PANEL_COMPONENTS 중 하나를 import해서 쓰는
// page.tsx 파일마다, 그 파일 전체 텍스트 안에 "erp-comm-shell" 문자열이
// (어디든) 있는지 확인한다. 새로 comm 디자인의 공용 패널/바디 컴포넌트를
// 만들면 이 목록에 추가하세요.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src", "app", "(dashboard)");

const COMM_PANEL_COMPONENTS = [
  "AnnouncementDetailPanel",
  "DocumentDetailPanel",
  "OfficialDocumentDetailPanel",
  "ApprovalDetailPanel",
];

const ALLOWLIST = new Set([]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (entry.name === "page.tsx") {
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
  const usedComponents = COMM_PANEL_COMPONENTS.filter((name) => new RegExp(`<${name}\\b`).test(text));
  if (usedComponents.length === 0) continue;
  checked += 1;
  const rel = path.relative(path.join(__dirname, ".."), file);
  if (ALLOWLIST.has(rel)) continue;
  if (!text.includes("erp-comm-shell")) {
    violations.push(`${rel} (${usedComponents.join(", ")})`);
  }
}

if (violations.length > 0) {
  console.error("comm 디자인 상세 패널을 쓰는데 erp-comm-shell 래퍼가 없는 곳 발견:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error("\n페이지의 가장 바깥 <div>에 className=\"erp-comm-shell\"을 추가하세요.");
  process.exit(1);
}

console.log(`comm 패널 스코프 검사 통과 (검사한 파일 ${checked}개, 위반 없음)`);
