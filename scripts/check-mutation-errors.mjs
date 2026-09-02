#!/usr/bin/env node
// 8차 감사에서 toggleTodo/toggleAnnouncementRead/updateUserRole이 Supabase
// mutation(.update/.delete/.insert/.upsert/.rpc)의 error를 버려서, 실패해도
// 성공한 것처럼 화면에 남아있던 버그를 찾았다. check-pagination.mjs와 같은
// 이유로 자동화한다 — 사람이 감사 라운드마다 다시 찾게 두지 않는다.
//
// 검사 방법: `<expr>.update(...)`, `.delete(...)`, `.insert(...)`,
// `.upsert(...)`, `.rpc(...)` 호출을 찾은 뒤, 그 호출 결과가 `error`라는
// 이름으로 구조분해돼 변수에 담기는지 확인한다. 담기지 않으면(결과를 아예
// 버리거나 error 없이 data만 받으면) 위반으로 보고한다.
//
// 알려진 한계(이 스크립트가 못 잡거나 오탐일 수 있는 경우):
// - Promise.all(items.map((x) => supabase.from(...).update(...)))처럼 결과가
//   배열로 흘러가 나중에 .some(r => r.error)로 확인되는 경우는 이 검사가
//   놓칠 수 있다(반대로 이런 형태는 대체로 안전하게 쓰이고 있어 오탐보다
//   미탐 쪽이 나은 트레이드오프로 판단했다).
// - RPC 이름이 get_/list_/fetch_로 시작하면 조회용으로 보고 건너뛴다.
// - .select()만 있고 update/delete/insert/upsert/rpc가 없는 순수 조회
//   체인은 이 스크립트 대상이 아니다(check-pagination.mjs 담당).
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const MUTATION_NAMES = new Set(["update", "delete", "insert", "upsert"]);

const ALLOWLIST = new Set([
  // mark_todo_side_done: 다른 직원의 할일도 완료 처리할 수 있어야 해서
  // security definer RPC로 우회한다. 호출부(sales/purchases actions.ts)가
  // 이미 "할일 완료 처리는 부가 동작이라 등록 자체를 막지 않는다"는 명시적
  // try/catch로 감싸고 있어, 실패를 의도적으로 무시한다.
  "src/lib/todo-flow.ts:42",
  // applyDuePriceSchedules/applyDuePurchasePriceSchedules: 화면을 열 때마다
  // 자동으로 시도하는 eventually-consistent 동기화다 — 이번에 실패해도
  // 다음에 누가 화면을 열면 다시 시도되므로 놓칠 일이 없다(주석 참고).
  "src/lib/price-schedule.ts:17",
  "src/lib/price-schedule.ts:22",
  // recordPackageQtyChange: 참고용 이력 로그일 뿐이라 실패해도 상품 저장
  // 자체(이미 끝난 뒤)를 막지 않기로 명시적으로 설계됨(주석 참고).
  "src/app/(dashboard)/products/actions.ts:83",
]);

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

// mutationCall이 .from("table")로 시작하는 체인 위에 있는지 확인한다
// (supabase 클라이언트 호출만 대상으로 하고, 다른 라이브러리의 동명 메서드는
// 건드리지 않기 위함).
function isSupabaseTableCall(mutationCallNode) {
  let current = mutationCallNode.expression.expression;
  while (current) {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      if (current.expression.name.text === "from") return true;
      current = current.expression.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    return false;
  }
  return false;
}

function isRpcCall(node) {
  return getCallName(node) === "rpc";
}

// mutationCall(호출 자체, await 이전) 바로 위를 딱 한 단계만 살펴서 결과가
// 어떻게 쓰이는지 판단한다 — 여러 단계 위까지 올라가며 스코프를 넘나들면
// (예: 함수 경계) 오히려 관계없는 바깥쪽 변수선언을 잘못 집어내는 문제가
// 있어서, "바로 감싸는 문장 하나"만 본다.
//   - `await mutationCall;` 처럼 그 자체가 문장이면 → 결과를 완전히
//     버리는 것 → 위반.
//   - `const { error } = await mutationCall;` → error를 받으면 안전.
//   - `const { data } = await mutationCall;` (error 없이 data만) → 위반.
//   - 그 외(반환, 배열 안, .then() 등 더 복잡한 흐름)는 판단을 보류한다
//     (오탐 방지 — Promise.all(...) 등으로 나중에 확인하는 안전한 패턴이
//     섞여 있을 수 있다).
function hasErrorBinding(mutationCallNode) {
  // .update(...)/.rpc(...) 뒤에 .eq(...)/.select(...) 등이 더 체이닝될 수
  // 있으니(예: .update(x).eq("id", id)), 실제로 await/대입되는 건 그 체인의
  // 가장 바깥쪽 호출이다 — 거기까지 올라간다.
  let expr = mutationCallNode;
  while (
    expr.parent &&
    ts.isPropertyAccessExpression(expr.parent) &&
    expr.parent.expression === expr &&
    expr.parent.parent &&
    ts.isCallExpression(expr.parent.parent) &&
    expr.parent.parent.expression === expr.parent
  ) {
    expr = expr.parent.parent;
  }

  if (ts.isAwaitExpression(expr.parent) && expr.parent.expression === expr) {
    expr = expr.parent;
  }

  const parent = expr.parent;

  if (ts.isExpressionStatement(parent) && parent.expression === expr) {
    return false; // 결과를 완전히 버림
  }

  if (ts.isVariableDeclaration(parent) && parent.initializer === expr) {
    const name = parent.name;
    if (ts.isObjectBindingPattern(name)) {
      return name.elements.some((el) => {
        const boundName = el.propertyName ? el.propertyName : el.name;
        return ts.isIdentifier(boundName) && boundName.text === "error";
      });
    }
    // 구조분해가 아니라 `const result = await mutationCall;`처럼 통째로
    // 받은 경우, require-mutated-row.ts의 공용 헬퍼(requireMutatedRow/
    // wasRowMutated)에 그 변수를 그대로 넘기는 것도 error+행수를 함께
    // 확인하는 안전한 패턴으로 인정한다.
    if (ts.isIdentifier(name) && isPassedToMutationHelper(parent, name.text)) {
      return true;
    }
    return false;
  }

  return null; // 판단 보류
}

const MUTATION_HELPER_NAMES = new Set(["requireMutatedRow", "wasRowMutated"]);

// declaration이 속한 함수(또는 최상위) 안에서, variableName을 첫 인자로
// requireMutatedRow(...)/wasRowMutated(...)를 호출하는 곳이 있는지 찾는다.
function isPassedToMutationHelper(declarationNode, variableName) {
  let scope = declarationNode.parent;
  while (
    scope &&
    !ts.isFunctionDeclaration(scope) &&
    !ts.isFunctionExpression(scope) &&
    !ts.isArrowFunction(scope) &&
    !ts.isSourceFile(scope)
  ) {
    scope = scope.parent;
  }
  if (!scope) return false;

  let found = false;
  function visit(node) {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      MUTATION_HELPER_NAMES.has(node.expression.text) &&
      node.arguments[0] &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === variableName
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(scope);
  return found;
}

// mutationCall이 Promise.all([...]) / arr.map(...) 안에서 쓰이는지 —
// 이 경우 error 확인이 나중에 배열 단위로(.some/.filter 등) 이뤄지는 게
// 흔한 패턴이라, 오탐을 피하려고 검사 대상에서 제외한다.
function isInsideArrayFlow(node) {
  let current = node.parent;
  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      // 이 함수가 .map(...)의 콜백이거나 Promise.all(...)의 인자 배열 안에 있으면 배열 흐름으로 본다.
      const fn = current;
      if (fn.parent && ts.isCallExpression(fn.parent)) {
        const callee = fn.parent.expression;
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === "map") return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function checkFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const relPath = path.relative(path.join(__dirname, ".."), filePath);
  const violations = [];

  function visit(node) {
    const name = getCallName(node);
    if (name && (MUTATION_NAMES.has(name) || name === "rpc")) {
      const isMutation = MUTATION_NAMES.has(name) ? isSupabaseTableCall(node) : isRpcCall(node);
      if (isMutation) {
        const rpcNameArg = name === "rpc" ? node.arguments[0] : null;
        const rpcName = rpcNameArg && ts.isStringLiteralLike(rpcNameArg) ? rpcNameArg.text : null;
        const isReadOnlyRpc = rpcName && /^(get|list|fetch)_/.test(rpcName);
        if (!isReadOnlyRpc && !isInsideArrayFlow(node)) {
          const errorBound = hasErrorBinding(node);
          if (errorBound === false) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const key = `${relPath}:${line + 1}`;
            if (!ALLOWLIST.has(key)) {
              violations.push({ key, name });
            }
          }
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
  console.error("mutation 결과의 error를 확인하지 않는 곳 발견:\n");
  for (const v of violations) {
    console.error(`  ${v.key}  — .${v.name}(...) 결과를 { error }로 받지 않음`);
  }
  console.error(
    "\n실패해도 조용히 성공한 것처럼 넘어갈 수 있습니다. { error }로 받아서 확인하세요."
  );
  console.error(
    "정말 확인이 필요 없는 경우(예: 결과를 나중에 배열 단위로 확인)라면 scripts/check-mutation-errors.mjs의 ALLOWLIST에 이유와 함께 추가하세요."
  );
  process.exit(1);
} else {
  console.log(`mutation 에러 확인 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
