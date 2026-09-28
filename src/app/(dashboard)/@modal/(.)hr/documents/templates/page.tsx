// @modal/(.)inventory/count/page.tsx와 같은 이유 — 자세한 배경은 그
// 파일의 주석과 src/lib/is-uuid.ts 참고. /hr/documents/[id]가 형제 경로
// "templates"를 자기 몫으로 착각하는 걸 막는다.
export default function HrDocumentsTemplatesModalPassthrough() {
  return null;
}
