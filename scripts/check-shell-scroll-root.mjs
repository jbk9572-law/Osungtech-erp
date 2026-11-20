// 앱 셸(.erp)은 화면 높이를 꽉 채우고 안쪽만 스크롤한다 — 문서(html/body) 스크롤을 막는 규칙이 없으면
// 문서가 스크롤될 때 앱이 밀려 올라가며 아래에 빈 공간이 드러난다(회사정보 저장 후 스크롤 버그).
// 이 검사는 그 규칙(과 인쇄 시 되돌리는 규칙)이 erp-theme.css에서 지워지지 않았는지 확인한다.
import fs from "node:fs";

const css = fs.readFileSync("src/app/erp-theme.css", "utf8");
const errors = [];
if (!/html:has\(\.erp\),\s*html:has\(\.erp\) body\s*\{[^}]*overflow:\s*hidden/.test(css)) {
  errors.push("erp-theme.css: html:has(.erp)/body에 overflow: hidden 규칙이 없습니다(문서 스크롤 방지)");
}
if (!/@media print\s*\{\s*html:has\(\.erp\),\s*html:has\(\.erp\) body\s*\{[^}]*overflow:\s*visible/.test(css)) {
  errors.push("erp-theme.css: 인쇄 시 문서 스크롤 제한을 되돌리는 @media print 규칙이 없습니다");
}
if (!/\.erp\s*\{\s*height:\s*100vh;\s*height:\s*100dvh;/.test(css)) {
  errors.push("erp-theme.css: .erp 높이가 100vh/100dvh가 아닙니다");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("check-shell-scroll-root: OK");
