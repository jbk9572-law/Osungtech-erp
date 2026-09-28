// @modal/(.)inventory/count/page.tsx와 같은 이유 — 자세한 배경은
// src/components/erp/modal-passthrough.tsx 참고. /inventory/transfers
// 자체는 /inventory/warehouses로 리다이렉트하는 페이지라 모달로 뜰 일이
// 없다. 단, 이 폴더 하위의 [id]/new는 진짜 모달(이동 상세/신규)이므로
// loading.tsx는 각각 별도로 원래 스피너를 복원해뒀다.
export { default } from "@/components/erp/modal-passthrough";
