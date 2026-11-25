// (dashboard)/layout.tsx가 서버에서 회사정보/프로필/테넌트 등을 비동기로 조회하는 동안(약 1~2초) Next.js가 이 화면을 먼저 보여준다.
// 예전에는 아이폰 사파리의 노치/다이나믹 아일랜드 색을 채우려고 화면 위에 파란 막대(.erp-notch-guard)를 그렸지만,
// 이동할 때마다 뜬금없는 파란 막대가 보인다는 지적으로 없앴다 — 대신 이동 중 아주 잠깐 노치 영역이 기본색(흰색)으로 보일 수 있다.
export default function DashboardLoading() {
  return (
    <div className="erp-u-flex erp-u-col erp-u-minh-screen">
      {/* data-erp-route-loading: route-progress-bar.tsx가 이 마커로
          "주소는 바뀌었지만 아직 이 자리엔 로딩 화면뿐"임을 구분한다. */}
      <div className="erp-loading-panel erp-u-flex-1" data-erp-route-loading>
        <div className="erp-loading-gauge" aria-hidden />
        조회 중...
      </div>
    </div>
  );
}
