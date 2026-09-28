// @modal/(.)inventory/[productId]가 "/inventory/:무엇이든"을 전부 자기
// 몫(productId)으로 착각해 가로채는 문제의 진짜 원인 수정 — default.tsx로
// 넘기는 대신, /inventory의 각 정적 형제 경로마다 "여긴 모달이 아니다"를
// 명시하는 빈 페이지를 둬서 Next.js가 이 경로를 [productId]와 헷갈리지
// 않게 한다(자세한 배경은 src/lib/is-uuid.ts 참고). 이 파일이 없으면
// 재고관리 메뉴 안에서 이 화면으로 이동할 때마다 정상적인 이동인데도
// "이 항목을 찾을 수 없습니다" 모달이 잠깐 끼어들어 보였다.
export default function InventoryCountModalPassthrough() {
  return null;
}
