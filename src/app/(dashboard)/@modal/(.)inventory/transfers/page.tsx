// @modal/(.)inventory/count/page.tsx와 같은 이유 — 자세한 배경은 그
// 파일의 주석과 src/lib/is-uuid.ts 참고. /inventory/transfers 자체는
// /inventory/warehouses로 리다이렉트하는 페이지라 모달로 뜰 일이 없다.
export default function InventoryTransfersModalPassthrough() {
  return null;
}
