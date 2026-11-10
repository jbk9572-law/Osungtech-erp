export default function PlatformAdminLoading() {
  return (
    // data-erp-route-loading: route-progress-bar.tsx가 이 마커로
    // "주소는 바뀌었지만 아직 이 자리엔 로딩 화면뿐"임을 구분한다.
    <div className="erp-loading-panel" data-erp-route-loading>
      <div className="erp-loading-gauge" aria-hidden />
      조회 중...
    </div>
  );
}
