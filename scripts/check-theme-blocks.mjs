// 테마 블록([data-theme="x"]) 규칙 — 테마는 "토큰 값"만 바꾼다.
//  1) 블록 안에는 --erp-* 선언만 있어야 한다(일반 속성/하위 셀렉터로 규칙을 덮어쓰면 땜질이 된다).
//  2) 블록이 바꾸는 토큰은 전부 :root에 정의돼 있어야 한다(오타/없는 토큰 방지).
//  3) 클래식(:root)에서 테마가 "바꿀 수 있어야 하는" 구조 토큰 집합이 비어 있지 않은지는 2번으로 충분.
//  4) CSS 어디에도 [data-theme="x"] 뒤에 자손 셀렉터(예: [data-theme="x"] .erp-grid)가 없어야 한다.
import fs from "node:fs";

const file = "src/app/erp-theme.css";
const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const errors = [];

const rootMatch = css.match(/(^|\n):root\s*\{([\s\S]*?)\n\}/);
const rootTokens = new Set([...(rootMatch?.[2] ?? "").matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

// 1·4: data-theme가 들어간 모든 규칙 검사
const ruleRe = /([^{}]*\[data-theme[^{}]*)\{([^{}]*)\}/g;
let m;
while ((m = ruleRe.exec(css))) {
  const selector = m[1].trim();
  const body = m[2];
  const line = css.slice(0, m.index + m[1].length - m[1].trimStart().length).split("\n").length;
  if (!/^\[data-theme="[\w-]+"\](\s*,\s*\[data-theme="[\w-]+"\])*$/.test(selector)) {
    errors.push(`${file}:${line} 테마 셀렉터는 [data-theme="이름"] (여러 테마가 같은 값을 공유할 때만 쉼표로 나열)만 쓸 수 있습니다 (발견: ${selector.slice(0, 60)})`);
    continue;
  }
  for (const decl of body.split(";").map((d) => d.trim()).filter(Boolean)) {
    const prop = decl.split(":")[0].trim();
    if (!prop.startsWith("--erp-")) {
      errors.push(`${file}:${line} 테마 블록에 토큰이 아닌 선언이 있습니다: ${prop}`);
    } else if (!rootTokens.has(prop)) {
      errors.push(`${file}:${line} ${prop} 는 :root에 정의되지 않은 토큰입니다`);
    }
  }
}

// 5) 날짜 상태 행(rowDayClass)을 쓰는 표는 행 색 범례(GridRowLegend)도 같이 둔다 — 색 규칙이 화면에 설명 없이 남지 않게.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(f) : f.endsWith(".tsx") ? [f] : [];
  });
}
for (const f of walk("src")) {
  const t = fs.readFileSync(f, "utf8");
  if (/rowDayClass\(/.test(t) && !/GridRowLegend/.test(t)) {
    errors.push(`${f} rowDayClass를 쓰는데 <GridRowLegend />가 없습니다`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("check-theme-blocks: OK");
