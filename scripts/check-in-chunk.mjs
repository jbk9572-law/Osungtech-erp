#!/usr/bin/env node
// PostgREST 의 .in("col", ids) 는 id 목록을 요청 주소(URL)에 그대로 이어 붙인다. UUID 수백 개면 주소가 너무 길어져
// 서버가 연결을 끊고 서버 화면이 "TypeError: fetch failed"로 죽는다(샌드박스 더미 데이터로 오늘 작업분이 많아진 메인 대시보드에서 실제 발생).
// 데이터가 늘수록 비례해 터지고, 작은 테스트 데이터에서는 안 보인다 — 그래서 자동으로 막는다:
//  · .in() 의 값은 (1) 배열 리터럴(["a","b"]) 이거나 (2) lib/fetch-all-rows.ts 의 fetchAllRowsIn/selectInChunks 가 넘겨 주는 조각(idChunk 등)이어야 한다.
//  · 목록이 정말 작은 게 보장되는 곳(회사 직원 수, 결재선 등)만 아래 ALLOWLIST 에 "파일::변수 — 이유"로 등록한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const CHUNK_NAMES = /^(idChunk|skuChunk|numberChunk|codeChunk|chunk|ids?Chunk)$/;
const ALLOWLIST = {
  "app/(dashboard)/board/page.tsx::noticeIds": "게시판 한 분류의 공지 최근 N건(PER_CATEGORY_LIMIT)",
  "app/(dashboard)/inventory/actions.ts::locationIds": "한 창고의 위치(로케이션) 수",
  "app/(dashboard)/production/[id]/page.tsx::assignedSubcontractorIds": "한 생산지시 공정에 배정된 외주업체 수",
  "app/(dashboard)/production/new/page.tsx::componentProductIds": "한 완제품 BOM 의 구성품 수",
  "app/(dashboard)/todos/actions.ts::side": "상수 배열 두 개 중 하나",
  "components/approval-detail-panel.tsx::approverIds": "결재선(승인자) 몇 명",
  "lib/dashboard-approvals.ts::approverIds": "본인 + 오늘 유효한 위임자 몇 명",
  "lib/dev-seed/employees.ts::ids": "개발용 더미 데이터(운영 경로 아님)",
  "lib/dev-seed/master-data.ts::targetCustomers": "개발용 더미 데이터(운영 경로 아님)",
  "lib/mail/sync-all.ts::accounts": "메일 계정을 연동한 직원 수",
  "lib/server-error-log.ts::ids": "플랫폼 관리자 수(조회에 limit 50)",
  "lib/notifications.ts::types": "고정된 알림 종류 목록",
};
const SKIP = /(\.test\.tsx?$|database\.types\.ts$)/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !SKIP.test(name)) out.push(p);
  }
  return out;
}

const bad = [];
const re = /\.in\(\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,\s*([\s\S]*?)\)\s*(?=[.;,)\s]|$)/g;
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(re)) {
    const arg = m[1].trim();
    if (arg.startsWith("[")) continue; // 배열 리터럴
    const ident = arg.match(/^[A-Za-z_$][\w$]*/)?.[0] ?? arg.slice(0, 30);
    if (CHUNK_NAMES.test(ident) && arg === ident) continue;
    const key = `${rel}::${ident}`;
    if (key in ALLOWLIST) continue;
    const line = text.slice(0, m.index).split("\n").length;
    bad.push(`  ${rel}:${line}  .in(…, ${arg.slice(0, 50)})   → 키: ${key}`);
  }
}

if (bad.length) {
  console.error(".in() 에 길이가 보장되지 않은 id 목록을 직접 넣은 곳이 있습니다:\n");
  console.error(bad.join("\n"));
  console.error(
    "\nfetchAllRowsIn / selectInChunks(@/lib/fetch-all-rows)로 나눠 조회하세요. 목록이 정말 작다고 보장되면 scripts/check-in-chunk.mjs 의 ALLOWLIST 에 이유와 함께 추가하세요.",
  );
  process.exit(1);
}
console.log("in() 목록 길이 검사 통과");
