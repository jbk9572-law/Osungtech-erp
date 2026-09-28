// 이 경로는 pass-through(page.tsx가 null만 반환)라 아무 데이터도 안
// 불러온다. 상위 @modal/loading.tsx(무거운 모달 스피너, 내부에서
// document.body.style을 건드리는 스크롤락 포함)를 물려받지 않도록 같은
// 자리에서 오버라이드한다 — 자세한 배경은 src/components/erp/
// modal-passthrough.tsx 참고.
export { default } from "@/components/erp/modal-passthrough";
