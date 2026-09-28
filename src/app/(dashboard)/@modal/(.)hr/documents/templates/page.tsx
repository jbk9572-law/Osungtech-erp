// @modal/(.)inventory/count/page.tsx와 같은 이유 — 자세한 배경은
// src/components/erp/modal-passthrough.tsx 참고. /hr/documents/[id]가
// 형제 경로 "templates"를 자기 몫으로 착각하는 걸 막는다. 단, 이 폴더
// 하위의 [id]/edit·new는 진짜 모달(템플릿 수정/신규)이므로 loading.tsx는
// 각각 별도로 원래 스피너를 복원해뒀다.
export { default } from "@/components/erp/modal-passthrough";
