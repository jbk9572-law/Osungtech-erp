#!/usr/bin/env node
// products(...).select("...inventory(quantity, warehouse_id)")로 조인해오는
// inventory 배열은 정상적으로는 매칭되는 행이 없으면 빈 배열([])이어야
// 하지만, 그 상품의 재고 행이 RLS(테넌트/데모 격리)로 전부 가려지는 등의
// 상황에서 null/undefined로 내려오는 사례가 실제로 있었다. 재고관리 >
// 재고현황 화면은 먼저 이 문제를 겪고 `p.inventory ?? []`로 방어했는데,
// 같은 조인을 그대로 쓰는 재고실사/QR 자동실사/신규 매출 등록 등 다른
// 화면에는 그 방어가 안 옮겨져 있어서 `p.inventory.find(...)` 같은 호출이
// TypeError로 화면 전체를 죽이는 사고로 이어졌다(재고실사에서 반복
// 재현됐던 "일시적인 오류로 화면을 불러오지 못했습니다"의 실제 원인).
//
// src/lib/inventory-quantity.ts의 sumInventoryQuantity/findWarehouseQuantity/
// inventoryQuantityByWarehouse 세 헬퍼가 이미 null-safe하게 처리해주므로,
// 새 코드는 반드시 이 헬퍼를 거치게 한다 — `<expr>.inventory.find/reduce/
// map/filter/some/forEach(...)`처럼 inventory 배열에 직접 메서드를 호출하는
// 패턴을 찾아 위반으로 보고한다.
//
// 오탐이 있으면(정말 inventory가 절대 null/undefined일 수 없는 자리라면)
// ALLOWLIST에 "파일:줄번호"와 이유를 추가한다.

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "src");

const ALLOWLIST = new Set([
  // 이 헬퍼들 자체가 안전 처리의 구현부다.
  "src/lib/inventory-quantity.ts",
]);

const UNSAFE_METHODS = new Set(["find", "reduce", "map", "filter", "some", "forEach"]);

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walkDir(SRC_ROOT);
const violations = [];

for (const file of files) {
  const relPath = path.relative(path.join(__dirname, ".."), file);
  if (ALLOWLIST.has(relPath)) continue;

  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function visit(node) {
    // `<expr>.inventory.method(...)` — CallExpression whose callee is
    // `<expr>.inventory.method`, i.e. a PropertyAccessExpression on another
    // PropertyAccessExpression named "inventory".
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      UNSAFE_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "inventory"
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({ relPath, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

if (violations.length > 0) {
  console.error("inventory 배열에 null-safe 헬퍼 없이 직접 접근하는 곳 발견:\n");
  for (const v of violations) {
    console.error(`  ${v.relPath}:${v.line}`);
  }
  console.error(
    "\nsrc/lib/inventory-quantity.ts의 sumInventoryQuantity()/findWarehouseQuantity()/inventoryQuantityByWarehouse()를 쓰세요."
  );
  process.exit(1);
} else {
  console.log(`inventory null-safety 검사 통과 (검사한 파일 ${files.length}개, 위반 없음)`);
}
