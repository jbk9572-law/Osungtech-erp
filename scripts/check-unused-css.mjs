// erp-theme.css에 정의돼 있는데 코드(src)에서 한 번도 안 쓰는 .erp-* 클래스를 잡는다(죽은 규칙).
// `erp-badge-${tone}`처럼 클래스 이름을 조립해서 쓰는 경우는 "앞부분이 템플릿으로 조립되는지"까지
// 확인해서 사용 중으로 친다 — 그래서 조립형 클래스를 안 쓰는 걸로 오인해 지우는 사고를 막는다.
// (예전에 "안 쓰는 클래스 6개"라고 본 것 중 5개가 실제로는 조립형으로 쓰이고 있었다.)
import fs from "node:fs";
import path from "node:path";

const CSS = "src/app/erp-theme.css";
const css = fs.readFileSync(CSS, "utf8");
const names = new Set();
for (const m of css.matchAll(/\.(erp-[a-z0-9_-]+)/g)) names.add(m[1]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(p)) out.push(p);
  }
  return out;
}
const src = walk("src").map((f) => fs.readFileSync(f, "utf8")).join("\n");

const unused = [];
for (const name of names) {
  if (src.includes(name)) continue;
  const parts = name.split("-");
  let dynamic = false;
  for (let i = parts.length - 1; i >= 2 && !dynamic; i--) {
    const prefix = parts.slice(0, i).join("-") + "-";
    dynamic =
      src.includes(prefix + "${") || src.includes(prefix + '"+') || src.includes(prefix + "'+") || src.includes("`" + prefix);
  }
  if (!dynamic) unused.push(name);
}

if (unused.length) {
  console.error("안 쓰는 CSS 클래스 발견 (erp-theme.css에만 있고 코드에서 참조 없음):\n");
  for (const n of unused) console.error("  ." + n);
  console.error("\n정말 안 쓰면 erp-theme.css에서 규칙을 지우세요. 클래스 이름을 문자열로 조립해 쓰는 곳이면 그 조립 코드가 `접두어-${값}` 형태인지 확인하세요.");
  process.exit(1);
}
console.log(`안 쓰는 CSS 클래스 검사 통과 (정의된 클래스 ${names.size}개, 죽은 규칙 없음)`);
