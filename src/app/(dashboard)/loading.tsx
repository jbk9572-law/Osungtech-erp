// (dashboard)/layout.tsx가 서버에서 회사정보/프로필/테넌트 등을 비동기로
// 조회하는 동안(약 1~2초, 느리면 더 길게) Next.js가 이 화면을 먼저
// 보여준다 — 그동안 ErpShell의 .erp-titlebar(sticky, navy)가 아직
// DOM에 없다. 최신 iOS Safari는 theme-color 메타 태그를 더 이상
// 안정적으로 안 읽고, 대신 뷰포트 맨 위를 히트테스트해 거기 걸리는
// sticky/fixed 불투명 요소의 배경색을 그대로 노치/다이나믹 아일랜드에
// 칠한다(.erp-titlebar의 position:sticky 주석 참고, 같은 이유로 이미
// 한 번 고친 전례가 있다) — 그 요소가 아직 없으면 기본(흰색)으로
// 남아있다가, 조회가 끝나고 진짜 타이틀바가 마운트되는 순간에야 색이
// "채워지는" 것처럼 보인다(사용자 지적). 실제 타이틀바와 똑같은
// .erp-titlebar 클래스를 내용 없이 먼저 그려서, 로딩 중에도 Safari가
// 즉시 같은 자리에서 같은 색을 찾게 한다.
export default function DashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="erp-titlebar" aria-hidden />
      <div className="erp-loading-panel" style={{ flex: 1 }}>
        <div className="erp-loading-gauge" aria-hidden />
        조회 중...
      </div>
    </div>
  );
}
