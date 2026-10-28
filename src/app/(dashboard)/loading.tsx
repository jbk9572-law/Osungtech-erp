// (dashboard)/layout.tsx가 서버에서 회사정보/프로필/테넌트 등을 비동기로
// 조회하는 동안(약 1~2초, 느리면 더 길게) Next.js가 이 화면을 먼저
// 보여준다 — 그동안 ErpShell의 .erp-titlebar(sticky, navy)가 아직
// DOM에 없다. 최신 iOS Safari는 theme-color 메타 태그를 더 이상
// 안정적으로 안 읽고, 대신 뷰포트 맨 위를 히트테스트해 거기 걸리는
// sticky/fixed 불투명 요소(80%+ 폭, 3px+ 높이)의 배경색을 그대로
// 노치/다이나믹 아일랜드에 칠한다 — 그 요소가 아직 없으면 기본(흰색)으로
// 남아있다가, 조회가 끝나고 진짜 타이틀바가 마운트되는 순간에야 색이
// "채워지는" 것처럼 보인다.
//
// 처음엔 진짜 타이틀바를 통째로 흉내 냈는데(로고까지 넣어서), "이동
// 중에 뜬금없이 로고만 보이는 게 오히려 더 어색하다"는 지적을 받았다 —
// 가짜 헤더를 흉내 내는 대신, 아예 최대한 티 안 나는 얇은 로딩 바
// 하나로 바꿨다(.erp-notch-guard) — 노치 조건(불투명·고정·3px+)만
// 만족하는 최소 크기라 "헤더처럼 보이려다 어긋나는" 문제 자체가 생기지
// 않는다.
export default function DashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="erp-notch-guard" aria-hidden />
      <div className="erp-loading-panel" style={{ flex: 1 }}>
        <div className="erp-loading-gauge" aria-hidden />
        조회 중...
      </div>
    </div>
  );
}
