#!/usr/bin/env node
// settings/company/actions.ts의 3개 함수(updateCompanyProfile/uploadBrandingImage/
// resetBrandingImage)가 "id로 안 고르고 RLS가 걸러주게 한다"는 의도로
// `.update(...)`만 쓰고 필터를 안 붙였는데, Supabase DB가 WHERE절 없는
// UPDATE 자체를 막고 있어서("UPDATE requires a WHERE clause") 저장이 항상
// 실패하는 버그가 있었다. RLS로 행이 걸러지는 것과 별개로, 쿼리 자체에
// 형식상의 필터가 최소 하나는 있어야 한다 — 이 검사는 그 필터를 깜빡한
// 곳을 자동으로 찾는다(check-mutation-errors.mjs와 같은 이유로 자동화).
//
// 검사 방법: `<expr>.from("table").update(...)` 체인을 찾아서, 그 뒤에
// eq/neq/match/in/gt/lt/gte/lte/not/filter/is/contains 등 필터 메서드가
// 하나라도 체이닝돼 있는지 확인한다. 없으면 위반으로 보고한다.
// (.delete()는 grep으로 전수 확인한 결과 전부 필터가 있어 이 스크립트의
// 검사 대상에서 제외했다 — 필요해지면 MUTATION_NAMES에 "delete" 추가.)
//
// 오탐이 있으면 ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const MUTATION_NAMES = new Set(["update"]);

const FILTER_METHODS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
  "contains",
  "containedBy",
  "rangeGt",
  "rangeGte",
  "rangeLt",
  "rangeLte",
  "rangeAdjacent",
  "overlaps",
  "textSearch",
  "match",
  "not",
  "filter",
  "or",
  "and",
]);

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

// mutationCall이 .from("table")로 시작하는 체인 위에 있는지 확인한다
// (supabase 클라이언트 호출만 대상으로 하고, 다른 라이브러리의 동명
// 메서드는 건드리지 않기 위함) — check-mutation-errors.mjs와 동일한 로직.
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

// mutationCall 뒤에 체이닝된 호출들을 순서대로 올라가며, 필터 메서드가
// 하나라도 있는지 확인한다.
function hasFilterChained(mutationCallNode) {
  let expr = mutationCallNode;
  while (
    expr.parent &&
    ts.isPropertyAccessExpression(expr.parent) &&
    expr.parent.expression === expr &&
    expr.parent.parent &&
    ts.isCallExpression(expr.parent.parent) &&
    expr.parent.parent.expression === expr.parent
  ) {
    if (FILTER_METHODS.has(expr.parent.name.text)) return true;
    expr = expr.parent.parent;
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
    if (name && MUTATION_NAMES.has(name) && isSupabaseTableCall(node)) {
      if (!hasFilterChained(node)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const key = `${relPath}:${line + 1}`;
        if (!ALLOWLIST.has(key)) {
          violations.push(key);
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
  console.error("필터(.eq 등) 없이 .update(...)만 쓰는 곳 발견:\n");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(
    "\nDB가 WHERE절 없는 UPDATE를 막고 있어 저장이 항상 실패합니다. RLS로만 행이 걸러지는 경우라도 .not(\"id\", \"is\", null)처럼 형식상 필터를 붙이세요."
  );
  console.error(
    "정말 필요 없는 경우라면 scripts/check-update-where-clause.mjs의 ALLOWLIST에 이유와 함께 추가하세요."
  );
  process.exit(1);
} else {
  console.log(`UPDATE 필터 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
