// @modal 슬롯에서 (.)inventory/[productId], (.)hr/documents/[id]처럼 동적
// 세그먼트가 형제 정적 경로(qr-labels, templates 등)까지 전부 자기 몫으로
// 착각해 가로채는 문제를 막기 위한 빈 페이지다. Next.js는 static 세그먼트를
// dynamic([id] 등)보다 우선 매칭하므로, 이 형제 이름 각각에 이 컴포넌트를
// 등록해두면 더 이상 [productId]/[id]로 안 새어나간다.
//
// 이 경로들은 실제로 아무 데이터도 불러오지 않으므로, 같은 디렉터리에
// loading.tsx도 이 컴포넌트를 그대로 재사용해 null만 반환하게 해야 한다 —
// 상위 @modal/loading.tsx(RegistrationModalShell 기반 무거운 모달 스피너)를
// 그대로 물려받으면, 그 안의 useScrollLock이 document.body.style을 직접
// 건드리는 전역 부작용이 있어 소프트 네비게이션 도중 잠깐 끼어들면서 화면이
// 멈춘 것처럼 보이는 회귀가 있었다(재고관리 화면 간 이동 시 더블클릭 필요 +
// 빈 화면 증상으로 재현됨).
export default function ModalPassthrough() {
  return null;
}
