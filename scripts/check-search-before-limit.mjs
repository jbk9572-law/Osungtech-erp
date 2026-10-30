#!/usr/bin/env node
// 목록 화면에서 검색어(q)로 걸러내는 matchesSearch()는 애플리케이션
// 메모리에서 동작하는데, 그 대상 데이터를 DB에서 가져올 때 페이지당 상한
// (.limit(limit) — limit은 searchParams의 표시 건수 상한, 보통 300)을 검색
// 여부와 무관하게 걸어버리면, 조회기간 안에 limit건보다 더 있을 때
// limit 밖으로 밀려난 행은 검색 대상에서 통째로 빠진다 — 화면엔 아무
// 에러도 안 뜨고 그냥 "검색해도 안 나오는" 것처럼 보인다(실제 사례 —
// 매출/매입/견적/매입의뢰/매입견적의뢰/영업활동 6개 화면이 전부 이
// 버그를 갖고 있었다, 사용자 제보: "규격 조회할 때 작성자가 다른 건은
// 조회가 안 된다" — 실은 작성자와 무관하게 limit 밖으로 밀려난 행
// 전부가 검색에서 빠지고 있었다). 한 곳을 고치고 끝내는 대신, 같은
// 실수가 새 화면에서 반복되지 않게 자동 검사로 못 박는다.
//
// 검사 방법: 이 파일이 matchesSearch(를 호출하면(=클라이언트 메모리에서
// 검색어로 거르는 화면이면), 그 안의 모든 `.limit(limit)` 호출(인자가
// "limit"이라는 식별자인 경우만 — 상수 .limit(1000) 같은 무관한 드롭다운
// 조회는 대상이 아니다)이 `keyword`(또는 `!keyword`) 조건으로 감싸져
// 있는지 확인한다. 감싸져 있지 않으면(검색 중에도 무조건 적용되면)
// 위반으로 본다.
//
// 올바른 패턴(sales/page.tsx 등 참고):
//   const rawItems = keyword
//     ? await fetchAllRows((from, to) => buildQuery().range(from, to))
//     : await buildQuery().limit(limit).then((r) => r.data ?? []);

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

function getCallName(node) {
  if (!ts.isCallExpression(node)) return null;
  const expr = node.expression;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

// node가 "keyword"(참일 때만) 또는 "!keyword"(거짓일 때만) 조건의 분기
// 안에 있어서, 검색 중이 아닐 때만 실행된다는 게 보장되는지 확인한다.
// 함수 경계(화살표 함수 등)를 넘어가면 더 이상 같은 제어흐름이 아니므로
// 거기서 탐색을 멈춘다.
function isGuardedByNotKeyword(node) {
  let current = node;
  let child = node;
  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isFunctionDeclaration(current)) {
      // 이 함수 자체가 호출되는 지점까지 더 올라가 볼 수도 있지만(예:
      // .then(() => ...) 콜백), 간단히 함수 경계에서 멈춘다 — 이 저장소의
      // 실제 패턴은 전부 함수 경계를 넘지 않고 바로 삼항연산자/if로 감싼다.
      return false;
    }
    if (ts.isConditionalExpression(current)) {
      const condText = current.condition.getText().trim();
      if (condText === "keyword" && child === current.whenFalse) return true;
      if (condText === "!keyword" && child === current.whenTrue) return true;
    }
    if (ts.isIfStatement(current)) {
      const condText = current.condition.getText().trim();
      if (condText === "!keyword" && current.thenStatement === child) return true;
      if (condText === "keyword" && current.elseStatement === child) return true;
    }
    child = current;
    current = current.parent;
  }
  return false;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  if (!text.includes("matchesSearch(")) return [];
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    if (
      getCallName(node) === "limit" &&
      node.arguments.length === 1 &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === "limit"
    ) {
      if (!isGuardedByNotKeyword(node)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) violations.push(key);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

const files = walkDir(SRC_ROOT);
let violations = [];
for (const file of files) {
  violations = violations.concat(checkFile(file));
}

if (violations.length > 0) {
  console.error(
    "검색 중에도 DB limit이 무조건 걸리는 쿼리 발견(조회기간 안에서 limit 밖으로 밀려난 행은 검색이 안 됨):\n",
  );
  for (const v of violations) {
    console.error(`  ${v}  — .limit(limit)이 keyword/!keyword 조건으로 감싸져 있지 않음`);
  }
  console.error(
    "\nmatchesSearch로 거르는 화면이면, 검색 중일 때는 fetchAllRows로 조회기간 전체를 가져오고 검색이 없을 때만 .limit(limit)을 쓰세요(sales/page.tsx 참고).",
  );
  process.exit(1);
} else {
  console.log(`검색-limit 순서 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
