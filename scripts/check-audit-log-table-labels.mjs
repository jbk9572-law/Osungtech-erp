#!/usr/bin/env node
// 사용자 지적 — audit_logs 감사 트리거가 DB에 새로 추가됐는데(예:
// migration 201의 customer_product_prices/supplier_product_prices)
// settings/audit-log/page.tsx의 번역표(TABLE_LABELS)를 같이 안 고쳐서,
// 그 테이블의 변경이력이 "구분"란에 영문 테이블명 그대로 나왔다 —
// "니가알기편한거지 내가알기 어렵잖아". 같은 실수가 또 반복될 수
// 있으니(버그 수정 규칙 3번), supabase/migrations의 `create trigger
// audit_*` 전부를 긁어 TABLE_LABELS에 빠진 게 있으면 lint에서 막는다.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
const AUDIT_LOG_PAGE = path.join(
  __dirname,
  "..",
  "src",
  "app",
  "(dashboard)",
  "settings",
  "audit-log",
  "page.tsx",
);

// 재고 조정(inventory_transactions)은 audit_logs 트리거가 아니라 그
// 테이블 자체가 이력이라 audit-log/page.tsx가 완전히 다른 경로
// (INVENTORY_TAB)로 처리한다 — TABLE_LABELS 대상이 아니다.
const EXPECTED_NOT_IN_TABLE_LABELS = new Set(["inventory_transactions"]);

const TRIGGER_PATTERN = /create\s+trigger\s+audit_\w+\s+after\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.(\w+)/gi;

const auditedTables = new Set();
for (const file of readdirSync(MIGRATIONS_DIR)) {
  if (!file.endsWith(".sql")) continue;
  const text = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  for (const m of text.matchAll(TRIGGER_PATTERN)) {
    auditedTables.add(m[1]);
  }
}

const pageText = readFileSync(AUDIT_LOG_PAGE, "utf8");
const tableLabelsMatch = pageText.match(/const TABLE_LABELS: Record<string, string> = \{([\s\S]*?)\n\};/);
if (!tableLabelsMatch) {
  console.error("check-audit-log-table-labels: TABLE_LABELS 선언을 못 찾았습니다 — audit-log/page.tsx 구조가 바뀌었나요?");
  process.exit(1);
}
const labeledTables = new Set(
  Array.from(tableLabelsMatch[1].matchAll(/^\s*(\w+):/gm)).map((m) => m[1]),
);

const missing = Array.from(auditedTables)
  .filter((t) => !EXPECTED_NOT_IN_TABLE_LABELS.has(t))
  .filter((t) => !labeledTables.has(t))
  .sort();

if (missing.length > 0) {
  console.error("감사로그(변경이력) 테이블 한글 번역 누락 발견:\n");
  for (const t of missing) {
    console.error(`  ${t} — DB에 audit_${t} 트리거는 있는데 audit-log/page.tsx의 TABLE_LABELS에 없음`);
  }
  console.error(
    "\nsrc/app/(dashboard)/settings/audit-log/page.tsx의 TABLE_LABELS(그리고 가능하면 FIELD_LABELS)에 추가하세요.",
  );
  process.exit(1);
}

console.log(
  `감사로그 테이블 번역 검사 통과 (DB 감사 트리거 ${auditedTables.size}개, 번역표 ${labeledTables.size}개)`,
);
