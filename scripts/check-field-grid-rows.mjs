#!/usr/bin/env node
// 입력 폼의 12칸 격자(erp-field-grid)에서 "한 줄이 12칸을 못 채워 칸 하나가 혼자 떨어지는" 배치를 막는다.
// 전례: 비밀번호 변경 시안에서 현재·새 비밀번호는 한 줄, 새 비밀번호 확인은 아래 줄에 혼자 떨어졌고,
// 요금제 폼은 칸 7개를 3칸씩 놓아 마지막 줄이 빈 채로 남았다(사용자 지적 — "이런 게 파편화").
//
// 검사: erp-field-grid 안의 바로 아래 칸(erp-field erp-span-N)들을 왼쪽부터 12칸씩 줄로 채워 보고, 12가 안 되는 줄이 있으면 위반.
// 조건부로 폭이 바뀌는 칸(className={`...${}`})이 있는 격자는 정적 검사로 확인할 수 없어 건너뛴다.
// 검색·조회 줄처럼 일부러 비워 두는 격자는 기준선(scripts/field-grid-rows-baseline.json)에 올라 있다 — 새 위반은 늘리지 못한다.
//   node scripts/check-field-grid-rows.mjs          검사
//   node scripts/check-field-grid-rows.mjs --write  기준선 갱신(줄이기만 허용)
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const BASELINE = "scripts/field-grid-rows-baseline.json";
const write = process.argv.includes("--write");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function violationsOf(file) {
  const s = fs.readFileSync(file, "utf8");
  const found = [];
  let ordinal = 0;
  const open = /<(div|form|section)\b[^>]*className="[^"]*erp-field-grid[^"]*"[^>]*>/g;
  let m;
  while ((m = open.exec(s))) {
    ordinal++;
    const tag = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let end = -1;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "g");
    re.lastIndex = start;
    let mm;
    while ((mm = re.exec(s))) {
      if (mm[2] === "/") continue;
      depth += mm[1] === "/" ? -1 : 1;
      if (depth === 0) {
        end = mm.index;
        break;
      }
    }
    if (end < 0) continue;
    const body = s.slice(start, end);
    if (/className=\{`[^`]*erp-span-/.test(body)) continue; // 조건부 폭 — 정적으로 확인 불가
    const spans = [...body.matchAll(/className="erp-field erp-span-(\d+)[^"]*"/g)].map((x) => Number(x[1]));
    if (!spans.length) continue;
    const rows = [];
    let cur = 0;
    for (const n of spans) {
      if (cur + n > 12) {
        rows.push(cur);
        cur = 0;
      }
      cur += n;
    }
    rows.push(cur);
    if (rows.some((r) => r !== 12)) found.push(`${file.replaceAll("\\", "/")}#${ordinal}`);
  }
  return found;
}

const now = walk(ROOT).flatMap(violationsOf).sort();
if (write) {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log(`기준선 ${now.length}곳 저장`);
  process.exit(0);
}
const base = new Set(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : []);
const added = now.filter((x) => !base.has(x));
if (added.length) {
  console.error("입력 폼 격자에서 12칸을 못 채우는 줄이 새로 생겼습니다(한 칸이 혼자 떨어짐):");
  for (const a of added) console.error(`  - ${a}`);
  console.error("→ 한 줄의 span 합을 12로 맞추세요(3칸=4+4+4, 2칸=6+6, 7칸=3+3+3+3 / 4+4+4). 검색·조회 줄이라 일부러 비우는 거면 기준선에 올립니다(--write).");
  process.exit(1);
}
const fixed = [...base].filter((x) => !now.includes(x));
console.log(`입력 폼 격자 검사 통과 (기준선 ${base.size}곳${fixed.length ? `, 이미 고친 ${fixed.length}곳은 --write로 기준선에서 뺄 수 있음` : ""})`);
