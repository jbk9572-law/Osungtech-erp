#!/usr/bin/env node
// 테넌트 삭제(delete_tenant_hard)가 "update or delete on table tenants
// violates foreign key constraint audit_logs_tenant_id_fkey on table
// audit_logs"로 실패하는 버그를 발견했다. delete_tenant_hard()는
// "tenant_id 컬럼은 전부 references tenants(id) on delete cascade로
// 걸려 있다"는 전제로 설계됐는데(migration 211 주석 참고), 실제로는
// migration 99의 32개 테이블 반복문을 비롯해 수십 곳이 on delete
// cascade 없이 만들어져 있었다 — 한 테이블을 고치면 다음 삭제 시도에서
// 또 다른 테이블의 같은 에러를 만나는 두더지잡기였다(migration 214에서
// pg_constraint를 조회해 기존 위반을 전부 DB 레벨로 일괄 수정함).
//
// 과거 마이그레이션 파일 텍스트 자체는 고치지 않는다(이미 적용된
// 마이그레이션을 수정하는 건 이 프로젝트의 컨벤션이 아니다 — 새
// 마이그레이션으로 고친다). 그래서 이 검사는 "새로 추가되는" tenant_id FK가
// 같은 실수를 반복하지 않게 막는 용도이고, migration 214 이전에 이미
// 존재하던 위반은 전부 ALLOWLIST에 올려둔다.
//
// 검사 방법: 각 마이그레이션 파일을 줄 단위로 훑어서, 한 줄에
// "tenant_id uuid"와 "references"와 "tenants"가 모두 있는데 같은 줄에
// "on delete cascade"가 없으면 위반으로 본다.
//
// 알려진 한계: 컬럼 선언이나 다이나믹 SQL(format() 문자열)이 여러 줄에
// 걸쳐 쓰이면(예: "tenant_id uuid"와 "references"가 다른 줄에 있는 경우)
// 이 검사가 놓칠 수 있다 — 이 코드베이스의 기존 관례는 전부 한 줄로
// 쓰므로 당장은 괜찮지만, 새 마이그레이션을 쓸 때도 한 줄 선언 관례를
// 유지하는 걸 권장한다.
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_ROOT = path.join(__dirname, "..", "supabase", "migrations");

// migration 214 이전부터 있던 위반(DB 레벨로는 migration 214에서 이미
// 일괄 수정됨) — 과거 파일 텍스트는 그대로 둔다.
const ALLOWLIST = new Set([
  "00000000000099_multi_tenant_isolation.sql:43",
  "00000000000099_multi_tenant_isolation.sql:76",
  "00000000000099_multi_tenant_isolation.sql:123",
  "00000000000099_multi_tenant_isolation.sql:176",
  "00000000000099_multi_tenant_isolation.sql:223",
  "00000000000100_bom_work_orders.sql:20",
  "00000000000100_bom_work_orders.sql:65",
  "00000000000102_approvals.sql:17",
  "00000000000102_approvals.sql:29",
  "00000000000105_hr_attendance.sql:21",
  "00000000000105_hr_attendance.sql:37",
  "00000000000105_hr_attendance.sql:48",
  "00000000000106_payroll.sql:28",
  "00000000000106_payroll.sql:38",
  "00000000000106_payroll.sql:60",
  "00000000000107_document_templates.sql:23",
  "00000000000107_document_templates.sql:42",
  "00000000000109_org_structure.sql:13",
  "00000000000111_approval_delegations.sql:21",
  "00000000000112_approval_line_presets.sql:14",
  "00000000000112_approval_line_presets.sql:50",
  "00000000000116_attendance_correction.sql:19",
  "00000000000158_income_tax_withholding.sql:28",
  "00000000000161_production_stages_and_customer_portal.sql:43",
  "00000000000161_production_stages_and_customer_portal.sql:79",
  "00000000000161_production_stages_and_customer_portal.sql:122",
  "00000000000161_production_stages_and_customer_portal.sql:398",
  "00000000000161_production_stages_and_customer_portal.sql:441",
  "00000000000161_production_stages_and_customer_portal.sql:469",
  "00000000000165_subcontractor_portal.sql:19",
  "00000000000167_subcontractor_receiving_and_defects.sql:35",
  "00000000000168_subcontractor_fees_custody_returns.sql:116",
  "00000000000168_subcontractor_fees_custody_returns.sql:146",
  "00000000000168_subcontractor_fees_custody_returns.sql:418",
  "00000000000176_purchase_received_invoices.sql:26",
  "00000000000177_leave_balance_hard_block_and_grants.sql:122",
]);

function checkFile(filePath) {
  const fileName = path.basename(filePath);
  const lines = readFileSync(filePath, "utf8").split("\n");
  const violations = [];

  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (
      /tenant_id\s+uuid/.test(lower) &&
      lower.includes("references") &&
      lower.includes("tenants") &&
      !lower.includes("on delete cascade")
    ) {
      const key = `${fileName}:${idx + 1}`;
      if (!ALLOWLIST.has(key)) {
        violations.push(key);
      }
    }
  });

  return violations;
}

const files = readdirSync(MIGRATIONS_ROOT)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => path.join(MIGRATIONS_ROOT, f));

let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error("tenant_id 외래키에 on delete cascade가 빠진 곳 발견:\n");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    "\n테넌트 삭제(delete_tenant_hard)는 tenant_id 외래키가 전부 on delete cascade로 걸려 있다는 전제로 동작합니다. cascade를 빼먹으면 테넌트 삭제가 그 테이블에서 FK 위반으로 실패합니다."
  );
  console.error(
    "정말 cascade가 없어야 하는 경우라면 scripts/check-tenant-fk-cascade.mjs의 ALLOWLIST에 이유와 함께 추가하세요."
  );
  process.exit(1);
} else {
  console.log(`tenant_id FK cascade 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
