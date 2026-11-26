// 새 메뉴를 추가하면 샌드박스 더미 데이터에서 어떻게 할지(채움/일부러 제외)를 정해 두게 한다.
// "더미생성할 때 메뉴에 있는 모든 걸 채워야 한다"는 요구가 메뉴가 늘 때마다 빠지는 일을 막는 기준선이다(scripts/sandbox-coverage.json).
// 메뉴 주소 목록이 기준선과 다르면 실패 — 새 메뉴는 기준선에 "seeded"(더미가 채움)나 "excluded: 이유"로 적고, 사라진 메뉴는 지운다.
import fs from "node:fs";
const menu = fs.readFileSync("src/lib/erp-menu.ts", "utf8");
const hrefs = [...new Set([...menu.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]))].sort();
const file = "scripts/sandbox-coverage.json";
let base = {};
if (fs.existsSync(file)) base = JSON.parse(fs.readFileSync(file, "utf8"));
if (process.argv.includes("--write")) {
  const next = {};
  for (const h of hrefs) next[h] = base[h] ?? "seeded";
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log(`sandbox-coverage: 기준선을 ${hrefs.length}개 메뉴로 갱신했습니다.`);
  process.exit(0);
}
const missing = hrefs.filter((h) => !(h in base));
const stale = Object.keys(base).filter((h) => !hrefs.includes(h));
if (missing.length || stale.length) {
  if (missing.length) console.error("샌드박스 더미 데이터 기준선에 없는 새 메뉴(\"seeded\" 또는 \"excluded: 이유\"로 scripts/sandbox-coverage.json에 추가하고, 채워야 하면 src/lib/dev-seed에 시드를 만드세요):\n  " + missing.join("\n  "));
  if (stale.length) console.error("기준선에는 있지만 메뉴에서 사라진 항목(지우세요):\n  " + stale.join("\n  "));
  process.exit(1);
}
console.log(`sandbox-coverage: OK (메뉴 ${hrefs.length}개)`);
