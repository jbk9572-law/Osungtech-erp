#!/usr/bin/env node
// 계산식 입력("=600*2")이 되는 칸(NumberInput/QuantityWithBoxInput의 allowFormula)은 그 식을 저장·복원하는 방식(formula/onFormulaChange +
// 서버의 saveInputFormulas/loadInputFormulas)에 연결돼 있어야 화면마다 규칙이 갈라지지 않는다.
// 아직 연결 안 된 곳은 기준선(scripts/formula-persistence-baseline.json)에 파일별 개수로 기록해 "빚"으로 보이게 하고, 늘어나면 실패한다.
// 연결해서 줄이면 `--write`로 기준선을 낮춘다.
import ts from "typescript";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const BASELINE = path.join(here, "formula-persistence-baseline.json");
const TARGETS = new Set(["NumberInput", "QuantityWithBoxInput"]);

// 식을 저장할 이유가 없는 화면 — 저장 뒤 다시 열어 볼 "문서"가 아니라 한 번 실행하고 끝나는 입력/계산 도구다.
// (저장된 결과가 입출고 기록 같은 원장으로만 남고 수정 화면이 없다.) 이유와 함께 올린다.
const EXEMPT = {
  "src/components/erp/mobile-item-entry-panel.tsx": "모바일 숫자 키패드에는 = 키가 없어 수식 입력을 켜지 않는다(저장 대상 아님)",
  "src/components/tax-invoice-items-grid.tsx": "세금계산서는 법정 서식 — 수정세금계산서 음수·공급가액/세액 직접 입력 등 경로가 달라 입력 식을 따로 저장하지 않는다",
  "src/components/inventory-adjust-form.tsx": "재고 조정은 입력 후 입출고 기록으로만 남고 다시 열어 고치는 화면이 없다",
  "src/components/inventory-count-form.tsx": "재고 실사 입력은 실행 후 실사 결과 기록으로만 남는다",
  "src/components/new-stock-transfer-form.tsx": "재고 이동은 실행 후 이동 기록으로만 남는다",
  "src/modules/paper-calc/components/manual-layout-client.tsx": "모조지 계산기 도구 — 계산 결과가 저장 대상이고 입력 식은 아니다",
  "src/modules/paper-calc/components/order-form-paper-calc-rows.tsx": "모조지 계산기 도구(위와 같음)",
  "src/modules/paper-calc/components/paper-calc-client.tsx": "모조지 계산기 도구(위와 같음)",
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

const counts = {};
for (const file of walk(path.join(ROOT, "src"))) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("allowFormula")) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let n = 0;
  (function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && TARGETS.has(node.tagName.getText(sf))) {
      const names = new Set(node.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText(sf)));
      if (names.has("allowFormula") && !names.has("formula")) n++;
    }
    ts.forEachChild(node, visit);
  })(sf);
  const rel = path.relative(ROOT, file);
  if (n > 0 && !(rel in EXEMPT)) counts[rel] = n;
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`기준선 기록: ${Object.keys(counts).length}개 파일, 식 저장 미연결 입력칸 ${total}개`);
  process.exit(0);
}
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const errors = [];
for (const [file, n] of Object.entries(counts)) {
  if (n > (baseline[file] ?? 0)) errors.push(`${file}: 식 저장 미연결 입력칸 ${n}개(기준선 ${baseline[file] ?? 0}개) — formula/onFormulaChange를 연결하세요`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  console.error("\n계산식 입력 칸은 식을 저장·복원해야 합니다(lib/input-formulas-server.ts, lib/item-formulas.ts, migration 277 참고).");
  process.exit(1);
}
console.log(`계산식 저장 연결 검사 통과 (미연결 ${total}개는 기준선 이내 — 연결해서 줄이면 --write로 기준선을 낮추세요)`);
