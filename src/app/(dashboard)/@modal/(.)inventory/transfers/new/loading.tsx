// 이 경로는 진짜 모달(데이터 조회 후 여는 상세/신규 화면)이라, 형제
// pass-through(../loading.tsx)가 null로 오버라이드했더라도 이 화면만은
// 원래의 @modal/loading.tsx 무거운 모달 스피너를 그대로 써야 한다 —
// 그렇지 않으면 로딩 중 아무 표시도 없이 빈 화면처럼 보인다.
export { default } from "@/app/(dashboard)/@modal/loading";
