#!/usr/bin/env node
// 문서 폼(매출·매입·견적서·구매요청서·세금계산서·지급결의서 등)의 틀을 화면마다 따로 조립하면, 테마가 바뀔 때(예: grid-modern의
// 제목줄·하단 저장 바) 일부 화면만 옛 구조로 남는다(파편화). 그래서 틀은 voucher-chrome.tsx의 공용 조각만 쓴다:
//   · <form> 클래스  → useDocSheetClass()   (className="erp-doc-sheet" 직접 쓰기 금지)
//   · 제목          → <VoucherTitle>         (<h2 className="erp-doc-title"> 직접 쓰기 금지)
// erp-doc-paper를 쓰는 파일은 위 두 가지를 모두 써야 한다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const OWNER = "components/erp/voucher-chrome.tsx";
const errors = [];
let checked = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.tsx$/.test(e.name)) {
      const rel = path.relative(root, full).replaceAll("\\", "/");
      if (rel === OWNER) continue;
      const src = readFileSync(full, "utf8");
      checked++;
      if (/className=["'`{][^>]*erp-doc-sheet/.test(src)) errors.push(`${rel}: erp-doc-sheet 클래스를 직접 씁니다 — useDocSheetClass()를 쓰세요`);
      if (/erp-doc-title/.test(src)) errors.push(`${rel}: erp-doc-title을 직접 씁니다 — <VoucherTitle>을 쓰세요`);
      if (/erp-doc-paper/.test(src) && !/useDocSheetClass\(/.test(src)) errors.push(`${rel}: erp-doc-paper를 쓰면서 useDocSheetClass()가 없습니다`);
    }
  }
}
walk(root);
if (errors.length) {
  console.error("문서 폼 틀 공용 조각 검사 실패:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`문서 폼 틀 공용 조각 검사 통과 (검사한 파일 ${checked}개, 위반 없음)`);
