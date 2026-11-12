#!/usr/bin/env node
// 서비스 키(createAdminClient)는 RLS(회사별 데이터 분리)를 완전히 우회한다 —
// 그걸 쓰는 코드는 "이 요청자가 정말 이 데이터를 만질 자격이 있는지"와 "다른
// 회사 데이터를 건드리지 않는지"를 코드로 직접 확인해야 하고, 한 곳이라도 빠지면
// 다른 회사 데이터가 새거나 바뀐다. 그래서 두 가지를 자동으로 막는다:
// 1) 서비스 키를 쓰는 파일은 아래 ALLOWLIST에 이유와 함께 등록된 곳뿐이어야 한다.
//    새 파일이 서비스 키를 쓰려면 이 목록에 추가하는 순간 사람이 "권한/회사 확인이
//    들어 있는가"를 같이 검토하게 된다.
// 2) 사용자 요청을 받는 파일(서버 액션/API/화면)은 같은 파일 안에 인증·권한 확인
//    흔적(AUTH_MARKERS)이 하나라도 있어야 한다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

// kind: "user" = 로그인 사용자 요청을 처리(같은 파일에 권한 확인 흔적 필수), "system" = 크론/시드/내부 라이브러리,
// "elsewhere" = 권한 확인이 이 파일 밖(DB 함수/상위 레이아웃)에서 이뤄짐(이유에 어디서인지 적는다)
const ALLOWLIST = {
  "app/(dashboard)/official-documents/actions.ts": ["user", "공문 발송 이력 처리"],
  "app/(dashboard)/official-documents/send-action.ts": ["user", "공문 메일 발송"],
  "app/(dashboard)/settings/backup/actions.ts": ["user", "회사 데이터 백업/복원(관리자)"],
  "app/(dashboard)/settings/sandbox/actions.ts": ["user", "샌드박스 초기화(관리자)"],
  "app/(dashboard)/settings/users/actions.ts": ["user", "직원 계정 생성/수정/삭제(관리자)"],
  "app/api/backup/export/route.ts": ["user", "전체 데이터 내려받기(관리자)"],
  "app/api/calendar/feed/route.ts": ["user", "캘린더 구독 주소(토큰으로 인증)"],
  "app/login/actions.ts": ["system", "로그인 전 아이디→이메일 조회(서버에서만)"],
  "app/platform-admin/actions.ts": ["user", "플랫폼 관리자 전용"],
  "app/platform-admin/stats/page.tsx": ["user", "플랫폼 관리자 통계"],
  "app/portal/(app)/assignments/actions.ts": ["elsewhere", "하청 포털 — 권한은 subcontractor_* DB 함수(portal_identity 확인)가 검사하고, 서비스 키는 그 결과의 회사 값으로 시스템 알림만 보낸다"],
  "app/portal/(app)/new/actions.ts": ["elsewhere", "거래처 포털 주문 — 권한은 portal_create_order DB 함수가 검사하고, 서비스 키는 방금 만든 주문 행의 회사로 알림만 보낸다"],
  "app/signup/actions.ts": ["system", "가입 처리(봇 방지 확인 후)"],
  "components/tenant-detail-panel.tsx": ["elsewhere", "플랫폼 관리자 고객사 상세 — platform-admin/layout.tsx가 requirePlatformAdmin으로 막는다"],
  "lib/dev-seed/client.ts": ["system", "개발용 더미 데이터"],
  "lib/dev-seed/run.ts": ["system", "개발용 더미 데이터"],
  "lib/mail/sync-all.ts": ["system", "메일 동기화 크론"],
  "lib/messenger-system-alerts.ts": ["system", "메신저 알림 크론"],
  "lib/notify.ts": ["system", "푸시 알림"],
  "lib/portal-account-actions.ts": ["user", "포털 계정 관리(직원)"],
  "lib/supabase/admin.ts": ["system", "서비스 키 클라이언트 정의"],
};

const AUTH_MARKERS = [
  "requireAdmin", "getUser", "requireAuthedApiUser", "requirePlatformAdmin", "isPlatformAdmin",
  "is_platform_admin", "auth.getUser", "portal_identity", "token", "CRON_SECRET", "requireAuth",
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const problems = [];
const used = new Set();
for (const file of walk(SRC_ROOT)) {
  const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
  const text = readFileSync(file, "utf8");
  if (!/createAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(text)) continue;
  used.add(rel);
  const entry = ALLOWLIST[rel];
  if (!entry) {
    problems.push(`${rel}: 서비스 키(createAdminClient)를 쓰는데 ALLOWLIST에 없습니다 — 권한/회사 확인이 들어 있는지 검토한 뒤 등록하세요.`);
    continue;
  }
  if (entry[0] === "user" && !AUTH_MARKERS.some((m) => text.includes(m))) {
    problems.push(`${rel}: 사용자 요청을 처리하는데 인증/권한 확인 흔적(${AUTH_MARKERS.slice(0, 4).join("/")} 등)이 없습니다.`);
  }
}
for (const rel of Object.keys(ALLOWLIST)) {
  if (!used.has(rel)) problems.push(`${rel}: ALLOWLIST에 있지만 더 이상 서비스 키를 쓰지 않습니다 — 목록에서 지우세요.`);
}

if (problems.length) {
  console.error("서비스 키 사용처 검사 실패:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`서비스 키 사용처 검사 통과 (${used.size}개 파일, 모두 등록·권한 확인 흔적 있음)`);
