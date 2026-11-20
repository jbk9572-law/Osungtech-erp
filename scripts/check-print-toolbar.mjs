#!/usr/bin/env node
// 인쇄 화면 맨 위 도구줄([닫기]+[인쇄하기])은 PrintToolbar(components/erp/print-toolbar.tsx) 한 곳에서만 만든다.
// 화면마다 <PrintButton>을 직접 배치하면 테마(grid-modern 등)가 바뀔 때 일부 인쇄 화면만 옛 모양으로 남는다(파편화).
// 의도적으로 직접 쓰는 화면은 이유와 함께 아래 EXEMPT에 적는다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const OWNERS = new Set(["components/erp/print-toolbar.tsx", "components/print-button.tsx"]);
const EXEMPT = {
  "app/(dashboard)/hr/documents/item/[id]/print/page.tsx": "닫기 버튼 없이 인쇄 버튼만 있는 공문 서식 화면(서식 자체가 종이 전용 스타일)",
  "app/(dashboard)/inventory/qr-labels/page.tsx": "QR 라벨 화면은 도구줄에 인쇄 버튼과 다른 이동 버튼이 함께 있는 목록형 화면",
};
const errors = [];
let checked = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.tsx$/.test(e.name)) {
      const rel = path.relative(root, full).replaceAll("\\", "/");
      if (OWNERS.has(rel) || rel in EXEMPT) continue;
      checked++;
      if (/from\s+["']@\/components\/print-button["']/.test(readFileSync(full, "utf8"))) {
        errors.push(`${rel}: PrintButton을 직접 씁니다 — <PrintToolbar>(@/components/erp/print-toolbar)를 쓰세요`);
      }
    }
  }
}
walk(root);
if (errors.length) {
  console.error("인쇄 도구줄 공용 컴포넌트 검사 실패:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`인쇄 도구줄 공용 컴포넌트 검사 통과 (검사한 파일 ${checked}개, 위반 없음)`);
