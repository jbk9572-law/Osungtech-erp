import "@/app/erp-theme.css";

// 로그인 화면(/portal/login)과 로그인 뒤 화면들((app) 그룹)이 공통으로
// 쓰는 스타일시트만 여기서 불러온다 — 인증 체크는 여기 두지 않는다(여기
// 걸면 로그인 화면 자체도 이 레이아웃 아래라 리다이렉트 루프가 생긴다).
// 실제 "로그인했는지" 확인은 portal/(app)/layout.tsx에서 한다.
export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
