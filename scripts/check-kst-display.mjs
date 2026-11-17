// 화면에 날짜·시각을 찍을 때 toLocale(Date|Time)String("ko-KR"...) 를 직접 쓰면 서버(UTC)와 브라우저(KST)가
// 같은 시각을 다르게 찍는다(KST 00~09시에 날짜가 하루 다름, hydration 불일치). → lib/kst-date.ts 의
// formatKstDate / formatKstDateTime / formatKstTime 을 쓰게 강제한다. 숫자 포맷(n.toLocaleString("ko-KR"))은 대상이 아니다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "src";
const SKIP = new Set(["src/lib/kst-date.ts"]);
// 날짜가 아니라 숫자에 쓰는 경우를 피하려고 'new Date(' 로 시작하거나 변수가 Date 인 흔한 형태만 잡는다.
const PATTERN = /(?:new Date\([^)]*\)|\b(?:d|date|dt|now)\b)\.toLocale(?:Date|Time)?String\(\s*["']ko-KR["']/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full.split(path.sep).join("/"));
  }
  return out;
}

const bad = [];
for (const f of walk(ROOT)) {
  if (SKIP.has(f)) continue;
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (line.trimStart().startsWith("//")) return;
    if (PATTERN.test(line)) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}
if (bad.length) {
  console.error(`날짜·시각을 직접 toLocale*String("ko-KR")로 찍은 곳 ${bad.length}건 — lib/kst-date.ts 의 formatKstDate/formatKstDateTime/formatKstTime 을 쓰세요:\n`);
  for (const b of bad) console.error("  " + b);
  process.exit(1);
}
console.log("KST 날짜 표시 검사 통과");
