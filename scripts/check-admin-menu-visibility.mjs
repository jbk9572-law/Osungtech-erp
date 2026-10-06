#!/usr/bin/env node
// 양방향으로 본다 — 두 파일(화면 자체의 차단, erp-menu.ts의 adminOnly
// 표시)을 사람이 항상 같이 기억해야 하는데, 둘 중 하나만 깜빡하면 서로
// 다른 방향으로 어긋난 사고가 난다:
//
// 1) "이 화면은 관리자만 볼 수 있습니다" 식으로 화면 전체를 막아버리는
//    페이지인데, 정작 왼쪽 메뉴/빠른검색/즐겨찾기에는 일반 사용자에게도
//    노출되어 있으면(erp-menu.ts에 adminOnly 표시가 없으면), 눌러도
//    벽만 보게 되는 메뉴 항목이 생긴다.
// 2) 반대로 erp-menu.ts에 adminOnly: true는 붙어 있어서 메뉴에서는 안
//    보이는데, 정작 화면 자체에는 아무 차단이 없으면 — 메뉴에서만
//    숨겨질 뿐 URL을 직접 알면 누구나 그대로 들어가 볼 수 있다
//    (settings/billing에서 실제로 있었던 사고 — 요금제/결제 정보가
//    방어 없이 노출돼 있었다).
//
// 검사 방법(1번): (dashboard) 아래 page.tsx 중 "관리자만 볼 수/접근할
// 수 있습니다" 벽 문구가 있는 파일을 찾아 라우트 경로를 뽑고,
// erp-menu.ts에 그 href를 쓰는 항목이 있는데 adminOnly: true가 없으면
// 위반으로 본다. 메뉴에 아예 없는 라우트(리다이렉트로만 진입 등)는
// 검사 대상이 아니다.
//
// 검사 방법(2번): erp-menu.ts에서 adminOnly: true인 항목의 href로
// page.tsx를 찾아, 그 파일에 벽 문구가 없으면 위반으로 본다. 동적
// 라우트 등 href가 바로 page.tsx 경로가 아닌 경우는 대상이 아니다.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const SRC_ROOT = path.join(REPO_ROOT, "src", "app", "(dashboard)");
const MENU_FILE = path.join(REPO_ROOT, "src", "lib", "erp-menu.ts");

// "파일경로" 형태로 추가하고 이유를 적을 것 (예: 관리자 아닌 사람도
// 봐야 하는 안내문 성격의 벽 문구라 이 검사 대상이 아닌 경우).
const ALLOWLIST = new Set([]);

const WALL_PHRASE_RE = /관리자만 (볼 수|접근할 수) 있습니다/;

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

function toRoute(filePath) {
  const rel = path.relative(SRC_ROOT, filePath);
  const dir = path.dirname(rel);
  if (dir === ".") return "/";
  return "/" + dir.split(path.sep).join("/");
}

const menuSource = readFileSync(MENU_FILE, "utf8");
// erp-menu.ts의 MenuLeaf 객체는 중첩 없이 한 겹짜리 { ... } 리터럴이라
// [^{}]*로 안전하게 통째로 잘라낼 수 있다.
const menuLeafObjects = menuSource.match(/\{[^{}]*\}/g) ?? [];

function findMenuLeafFor(route) {
  const hrefNeedle = `href: "${route}"`;
  return menuLeafObjects.find((obj) => obj.includes(hrefNeedle));
}

const pageFiles = walkDir(SRC_ROOT);
const violations = [];

for (const file of pageFiles) {
  if (file.includes("[")) continue; // 동적 라우트는 메뉴 href로 직접 등장하지 않는다
  const text = readFileSync(file, "utf8");
  if (!WALL_PHRASE_RE.test(text)) continue;

  const relPath = path.relative(REPO_ROOT, file);
  if (ALLOWLIST.has(relPath)) continue;

  const route = toRoute(file);
  const leaf = findMenuLeafFor(route);
  if (!leaf) continue; // 메뉴에 아예 없는 라우트는 검사 대상이 아니다
  if (!/adminOnly:\s*true/.test(leaf)) {
    violations.push({ relPath, route });
  }
}

// 반대 방향도 본다: erp-menu.ts에 adminOnly: true로 표시된 항목인데,
// 정작 그 화면 자체에는 "관리자만 볼 수 있습니다" 같은 서버 측 차단이
// 없는 경우 — 메뉴/빠른검색/즐겨찾기에서만 숨겨질 뿐, URL을 직접 알면
// 누구나 그대로 들어가 볼 수 있다(settings/billing에서 실제로 있었던
// 사고 — 요금제/결제 정보가 아무 방어 없이 노출돼 있었다).
const REVERSE_ALLOWLIST = new Set([]);
const reverseViolations = [];

for (const leaf of menuLeafObjects) {
  const hrefMatch = leaf.match(/href:\s*"([^"]+)"/);
  if (!hrefMatch) continue;
  if (!/adminOnly:\s*true/.test(leaf)) continue;
  const route = hrefMatch[1];
  if (REVERSE_ALLOWLIST.has(route)) continue;

  const pageFile = path.join(SRC_ROOT, route === "/" ? "" : route, "page.tsx");
  let pageText;
  try {
    pageText = readFileSync(pageFile, "utf8");
  } catch {
    continue; // 동적 라우트 등 page.tsx가 메뉴 href와 바로 안 맞는 경우는 검사 대상이 아니다
  }
  if (!WALL_PHRASE_RE.test(pageText)) {
    reverseViolations.push({ relPath: path.relative(REPO_ROOT, pageFile), route });
  }
}

if (violations.length > 0 || reverseViolations.length > 0) {
  if (violations.length > 0) {
    console.error(
      "관리자 전용 화면인데 메뉴에서 일반 사용자에게도 노출된 항목 발견:\n"
    );
    for (const v of violations) {
      console.error(`  ${v.relPath}  (${v.route}) — src/lib/erp-menu.ts의 해당 항목에 adminOnly: true 없음`);
    }
    console.error(
      "\n화면이 '관리자만 볼 수 있습니다'로 전체를 막고 있다면, src/lib/erp-menu.ts에서 그 항목에 adminOnly: true를 붙여 메뉴/빠른검색에서 일반 사용자에게 노출되지 않게 하세요."
    );
    console.error(
      "관리자 전용 벽이 아니라 다른 이유로 이 문구를 쓴 것이라면 scripts/check-admin-menu-visibility.mjs의 ALLOWLIST에 이유와 함께 추가하세요."
    );
  }
  if (reverseViolations.length > 0) {
    console.error(
      "\nerp-menu.ts에는 adminOnly: true인데 화면 자체엔 관리자 차단이 없는 항목 발견:\n"
    );
    for (const v of reverseViolations) {
      console.error(`  ${v.relPath}  (${v.route}) — 메뉴에서만 숨겨질 뿐 URL을 알면 누구나 들어가 볼 수 있음`);
    }
    console.error(
      "\n해당 page.tsx 맨 앞에서 getCurrentActor(또는 requireAdmin)로 isAdmin을 확인하고, 아니면 '이 화면은 관리자만 볼 수 있습니다' 벽을 보여주도록 추가하세요(src/app/(dashboard)/settings/features/page.tsx 참고)."
    );
    console.error(
      "실제로 관리자 전용이 아니라 메뉴에서만 숨기고 싶었던 거라면 scripts/check-admin-menu-visibility.mjs의 REVERSE_ALLOWLIST에 이유와 함께 추가하세요."
    );
  }
  process.exit(1);
} else {
  console.log(`관리자 전용 화면 메뉴 노출 검사 통과 (검사한 페이지 ${pageFiles.length}개, 위반 없음)`);
}
