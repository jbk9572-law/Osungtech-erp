// 신규·새 ○○ 버튼이 화면마다 다른 모양(파란색/빈 버튼)으로 갈라지지 않게 막는다 — 모든 "…/new" 이동 링크는 공용 <NewButton>을 쓴다.
// 예외: 같은 줄이나 바로 윗줄에 `check-new-button:ignore 이유`를 적은 곳(보조 신청 버튼 등). 클래식 파일·포털·모달 가로채기 경로는 대상이 아니다.
import fs from "node:fs";
import path from "node:path";

const ROOT = "src/app";
const bad = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "portal" || e.name.startsWith("@modal")) continue;
      walk(p);
    } else if (/\.tsx$/.test(e.name) && !/classic\.tsx$/.test(e.name)) {
      const lines = fs.readFileSync(p, "utf8").split("\n");
      lines.forEach((l, i) => {
        if (!/<(GuardedLink|Link)\b[^>]*href=("[^"]*\/new"|\{[^}]*\/new[^}]*\})[^>]*className="[^"]*\berp-btn\b/.test(l)) return;
        if (/check-new-button:ignore/.test(l) || /check-new-button:ignore/.test(lines[i - 1] ?? "")) return;
        bad.push(`${p}:${i + 1}`);
      });
    }
  }
}
walk(ROOT);
if (bad.length) {
  console.error("신규 버튼 통일 검사 실패 — 직접 만든 '신규' 링크 버튼이 있습니다. <NewButton>(components/erp/list-toolbar)을 쓰세요:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("신규 버튼 통일 검사 통과");
