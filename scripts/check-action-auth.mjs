#!/usr/bin/env node
// 서버 액션(actions.ts의 export async function)은 로그인하지 않은 요청도 주소만 알면 호출될 수 있다
// (공개 경로 /login 등에 Next-Action 헤더로 POST). 그래서 모든 액션은 "누가 호출했는지"를 확인하는 코드를
// 한 가지 이상 가져야 한다 — 로그인/권한 확인 함수를 부르거나, 사용자 세션 클라이언트(createClient, RLS가
// auth.uid()로 막는다)를 쓰거나, 서비스 키는 따로 check-admin-client가 본다. 메일 연결 테스트처럼 그런 것이
// 전혀 없는 액션이 실제로 있었다(무인증으로 서버가 외부 서버에 접속).
//
// 기준선(ALLOWLIST)에 없는 액션이 위 확인 없이 추가되면 실패한다. 의도적으로 공개여야 하는 액션(회원가입 등)은
// 이유와 함께 ALLOWLIST에 "파일:함수명"으로 적는다.
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const AUTH_TOKENS = [
  "createClient(", "getUser(", "requireAdmin(", "requirePlatformAdmin(", "requireAuth(", "getCurrentActor(",
  "canViewPage(", "canManageOrder(", "requireUser(", "getPortalIdentity(", "portalIdentity(", "createAdminClient(",
  "requireManagerOrAdmin(", "requireCurrentUser(", "assertPlatformAdmin(",
  // 인증을 함수 안에서 직접 하는 위임 대상(호출만 넘기는 얇은 액션용).
  "startTenantImpersonation(", "syncInbox(", "sendRecipientViaMock(",
];
// 의도적으로 로그인 없이 호출되는 액션(이유).
const ALLOWLIST = new Set([
  // 예: "app/signup/actions.ts:signUp" — 회원가입은 로그인 전 화면이다.
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/(^|[\\/])(actions|[\w-]*-action|[\w-]*actions)\.ts$/.test(full)) out.push(full);
  }
  return out;
}

const problems = [];
let checked = 0;
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  if (!/^["']use server["']/m.test(src.slice(0, 200))) continue;
  const rel = path.relative(root, file).split(path.sep).join("/");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  for (const stmt of sf.statements) {
    if (!ts.isFunctionDeclaration(stmt) || !stmt.name) continue;
    if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    checked += 1;
    const body = stmt.body?.getText(sf) ?? "";
    if (AUTH_TOKENS.some((t) => body.includes(t))) continue;
    const key = `${rel}:${stmt.name.text}`;
    if (ALLOWLIST.has(key)) continue;
    const line = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
    problems.push(`${rel}:${line} — ${stmt.name.text}: 로그인/권한 확인(또는 사용자 세션 클라이언트) 흔적이 없습니다`);
  }
}
if (problems.length) {
  console.error("서버 액션 인증 확인 검사 실패:\n" + problems.map((p) => "  - " + p).join("\n") +
    "\n\n액션 맨 앞에서 getUser()/requireAdmin()/canViewPage() 등으로 호출자를 확인하세요. 의도적으로 공개인 액션이면 scripts/check-action-auth.mjs의 ALLOWLIST에 이유와 함께 추가하세요.");
  process.exit(1);
}
console.log(`서버 액션 인증 확인 검사 통과 (액션 ${checked}개)`);
