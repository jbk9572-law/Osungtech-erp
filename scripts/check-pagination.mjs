#!/usr/bin/env node
// PostgREST(Supabase)는 .select() 한 번에 최대 1000행만 돌려준다
// (supabase/config.toml의 max_rows). 이 한도를 넘을 수 있는 테이블을
// fetchAllRows()로 감싸지 않고 그냥 .select()하면, 1000행을 넘는 순간부터
// 나머지 데이터가 화면에서 조용히(에러 없이) 사라진다 — 지금까지 이 종류의
// 버그가 감사 라운드마다 반복해서 발견된 이유는, 이걸 사람이 코드를 읽고
// 매번 새로 찾아야 했기 때문이다. 새 화면을 하나 추가할 때마다 다시 걸릴
// 수 있는 함정이라, 사람이 잡는 대신 커밋 시점에 항상 자동으로 잡히게
// 만든 것이 이 스크립트다 — npm run lint에 포함되어 항상 실행된다.
//
// 검사 방법: 소스를 TypeScript AST로 파싱해서 `.from("table")`로 시작해
// `.select(...)`를 포함하는 메서드 체인을 전부 찾은 뒤, 체인 전체(순서
// 무관 — update/delete는 select가 필터 뒤에 오고, 순수 조회는 필터가
// select 뒤에 온다)에서 다음 중 하나라도 있으면 안전하다고 본다:
//   - .range(...)                         명시적 페이지네이션
//   - .limit(...)                         인자가 뭐든 개발자가 상한을 의식한 것
//   - .single() / .maybeSingle()          최대 1행
//   - .insert(...)                        호출 쪽이 넘긴 배열 크기로 이미 제한됨
//   - .eq/.is/.match/.in(컬럼, ...)        컬럼명이 "id" 또는 "*_id"로 끝남
//     → 특정 부모 엔티티 하나로 좁히는 외래키 필터. 그 부모 하나에 딸린
//       자식 행 수는 이 회사 거래량(하루 매출+매입 합쳐 10건 안팎,
//       docs/db-backup-restore.md 참고)에서 사실상 1000행을 넘을 수 없다.
//       반대로 .eq("is_return", true)처럼 카테고리/플래그로만 거르는
//       필터는 시간이 지나며 전체 테이블처럼 계속 자랄 수 있어 안전하다고
//       보지 않는다 — 이 구분이 이 스크립트의 핵심이다.
//   - .gte/.gt와 .lte/.lt가 둘 다 있음    위아래로 닫힌 날짜/숫자 구간
//     (대시보드의 "이번 달" 집계처럼 — 구간 하나가 항상 유한하다)
//   - fetchAllRows(...) 콜백 안           이미 자체 페이지네이션 처리됨
// 그 외에는(필터 없이 테이블 전체를 그냥 select) 위반으로 보고한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

// 이 테이블들은 구조상 절대 1000행을 넘을 수 없어(직원 수, 창고 개수,
// 싱글턴 설정 등 거래량과 무관한 값) 예외로 둔다.
const SAFE_UNBOUNDED_TABLES = new Set([
  "warehouses", // 창고 1곳 기준 운영이라 사실상 1~2행
  "company_profile", // 싱글턴 설정 테이블 (id=1 고정)
  "profiles", // 이 회사 구성원 계정 수 — 거래량과 무관, 수십 명 규모
]);

const ALLOWLIST = new Set([
  // "src/app/(dashboard)/foo/page.tsx:12" 형태로 추가하고 이유를 여기 적을 것
]);

const ID_LIKE_COLUMN = /(^id$|_id$)/;
// 특정 날짜 하나로 정확히 좁히는 필터(예: .eq("purchase_orders.purchase_date",
// "2026-09-01"))도 하루치 거래로 좁히는 것이라 id 필터와 같은 이유로 안전하다.
const DATE_LIKE_COLUMN = /date/i;
const BOUNDING_FILTER_NAMES = new Set(["eq", "is", "match", "in"]);
const UPPER_BOUND_NAMES = new Set(["lte", "lt"]);
const LOWER_BOUND_NAMES = new Set(["gte", "gt"]);

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

// selectCall을 포함하는 전체 메서드 체인을 양쪽으로 다 훑어서
// {table, calls: [{name, args}]} 형태로 모은다. calls는 .from(...)부터
// 체인 맨 끝 호출까지 순서대로 들어간다.
function collectChain(selectCall) {
  // 1) 맨 끝(가장 바깥쪽) 호출까지 위로 올라간다.
  let outermost = selectCall;
  while (
    outermost.parent &&
    ts.isPropertyAccessExpression(outermost.parent) &&
    outermost.parent.expression === outermost &&
    outermost.parent.parent &&
    ts.isCallExpression(outermost.parent.parent) &&
    outermost.parent.parent.expression === outermost.parent
  ) {
    outermost = outermost.parent.parent;
  }

  // 2) outermost부터 아래로 내려가며 각 호출을 모으고, .from("table")에서 멈춘다.
  const calls = [];
  let table = null;
  let current = outermost;
  while (current) {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const name = current.expression.name.text;
      calls.unshift({ name, node: current });
      if (name === "from") {
        const arg = current.arguments[0];
        table = arg && ts.isStringLiteralLike(arg) ? arg.text : null;
        break;
      }
      current = current.expression.expression;
      continue;
    }
    break;
  }

  return { table, calls, outermost };
}

// 화살표/함수 표현식을 타고 올라가, 그 함수가 fetchAllRows(...)의 인자로
// 쓰였는지 확인한다.
function isInsideFetchAllRows(node) {
  let current = node;
  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const fn = current;
      if (fn.parent && ts.isCallExpression(fn.parent) && fn.parent.arguments.includes(fn)) {
        const callee = fn.parent.expression;
        if (ts.isIdentifier(callee) && callee.text === "fetchAllRows") return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function isChainSafe(calls, outermost) {
  const names = calls.map((c) => c.name);
  if (names.includes("range")) return true;
  if (names.includes("limit")) return true;
  if (names.includes("single") || names.includes("maybeSingle")) return true;
  if (names.includes("insert") || names.includes("upsert")) return true;

  const hasNarrowingFilter = calls.some((c) => {
    if (!BOUNDING_FILTER_NAMES.has(c.name)) return false;
    const arg = c.node.arguments[0];
    if (!(arg && ts.isStringLiteralLike(arg))) return false;
    return ID_LIKE_COLUMN.test(arg.text) || DATE_LIKE_COLUMN.test(arg.text);
  });
  if (hasNarrowingFilter) return true;

  const hasLowerBound = names.some((n) => LOWER_BOUND_NAMES.has(n));
  const hasUpperBound = names.some((n) => UPPER_BOUND_NAMES.has(n));
  if (hasLowerBound && hasUpperBound) return true;

  if (isInsideFetchAllRows(outermost)) return true;

  return false;
}

function selectHasHeadTrue(selectCallNode) {
  const opts = selectCallNode.arguments[1];
  if (!opts || !ts.isObjectLiteralExpression(opts)) return false;
  return opts.properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === "head" &&
      p.initializer.kind === ts.SyntaxKind.TrueKeyword
  );
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    if (getCallName(node) === "select" && !selectHasHeadTrue(node)) {
      const { table, calls, outermost } = collectChain(node);
      if (table && !SAFE_UNBOUNDED_TABLES.has(table) && !isChainSafe(calls, outermost)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          violations.push({ key, table });
        }
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
  console.error("페이지네이션 누락 의심 쿼리 발견 (PostgREST max_rows=1000을 넘으면 조용히 잘림):\n");
  for (const v of violations) {
    console.error(`  ${v.key}  — .from("${v.table}").select(...) 에 안전장치(.range/.limit/.single/id필터/닫힌구간필터) 없음`);
  }
  console.error(
    "\n1000행을 넘을 수 있는 테이블이면 fetchAllRows()로 감싸거나 .range()를 추가하세요."
  );
  console.error(
    "정말 1000행을 넘을 수 없는 게 확실하면 scripts/check-pagination.mjs의 ALLOWLIST(또는 SAFE_UNBOUNDED_TABLES)에 이유와 함께 추가하세요."
  );
  process.exit(1);
} else {
  console.log(`페이지네이션 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
