// 화면 안 "보기 전환"(링크로 다른 내용을 보여 주는 줄)은 밑줄형 탭(.erp-subtabs/.erp-subtab) 하나만 쓴다 — 칸막이 버튼(.erp-seg)이나 칩(.erp-date-preset-btn)으로
// 링크 전환을 만들면 화면마다 탭 모양이 갈라진다(개발헌법 3번). .erp-seg는 폼 값 고르기(출고/반품 등)에만 쓴다.
// 검사: .erp-seg 안에 <Link>/<a href>가 들어 있으면 실패.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const bad = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx") && !p.endsWith("classic.tsx") && !p.endsWith("print-option-bar.tsx")) { // 인쇄 옵션 고르기는 값 선택(칸막이 버튼)이라 예외
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/className="erp-seg[ "]/.test(line) || /className=\{`erp-seg[ `$]/.test(line)) {
          const next = lines.slice(i + 1, i + 5).join("\n");
          if (/<(Link|a)\s[^>]*href/.test(next)) bad.push(`${p}:${i + 1}`);
        }
      });
    }
  }
}
walk("src");
if (bad.length) {
  console.error("탭 모양 검사 실패 — 링크로 화면(보기)을 바꾸는 줄은 .erp-subtabs/.erp-subtab(밑줄형 탭)을 쓰세요:");
  for (const b of bad) console.error("  - " + b);
  process.exit(1);
}
console.log("탭 모양 검사 통과 (링크 전환 줄은 모두 밑줄형 탭)");
