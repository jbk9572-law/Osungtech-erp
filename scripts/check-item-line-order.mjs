// 매출·매입 품목을 읽는 쿼리가 created_at으로만 정렬하면, 한 전표의 품목(생성 시각이 전부 같음) 순서가 DB 마음대로가 된다.
// 품목 테이블을 읽으면서 created_at으로 정렬하는 쿼리는 반드시 line_no(입력 순서)도 같이 정렬해야 한다.
import fs from "node:fs";
import path from "node:path";
const roots = ["src"];
const bad = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && !p.includes("database.types")) scan(p);
  }
}
function scan(p) {
  const L = fs.readFileSync(p, "utf8").split("\n");
  L.forEach((line, i) => {
    if (!/\.from\("(sales|purchase)_order_items"\)/.test(line)) return;
    const chain = L.slice(i, i + 14);
    let end = chain.findIndex((l, k) => k > 0 && /\.from\(|^\s*\);?\s*$|^\s*const /.test(l));
    if (end < 0) end = chain.length;
    const text = chain.slice(0, end).join("\n");
    if (/\.order\("created_at"/.test(text) && !/\.order\("line_no"/.test(text)) bad.push(`${p}:${i + 1}`);
  });
}
for (const r of roots) walk(r);
if (bad.length) {
  console.error("품목 쿼리가 created_at으로만 정렬합니다 — .order(\"line_no\")를 같이 쓰세요(전표 하나만 읽으면 line_no 먼저, 여러 전표면 created_at 다음):");
  bad.forEach((b) => console.error("  " + b));
  process.exit(1);
}
console.log("check-item-line-order: OK");
