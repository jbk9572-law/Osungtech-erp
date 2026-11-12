import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";

// @modal 슬롯 전체에 적용되는 공용 로딩 화면. 매출/매입 신규 등록처럼
// 조회가 많은 화면은 모달 내용이 도착하기까지 시간이 걸리는데, 이 파일이
// 없으면 그 사이 상태가 이 슬롯 하나로 격리되지 않고 화면 전체(사이드바
// 포함) 레이아웃에 영향을 줄 수 있다 — 모달 모양 그대로 스피너만 보여줘서
// 그 사이에도 배경 화면(목록)이 멀쩡하게 유지되게 한다.
export default function ModalLoading() {
  return (
    <RegistrationModalShell size="xl">
      {/* data-erp-route-loading: route-progress-bar.tsx가 이 마커로
          "주소는 바뀌었지만 아직 이 자리엔 로딩 화면뿐"임을 구분한다. */}
      <div className="erp-u-flex erp-u-items-center erp-u-col erp-u-justify-center erp-u-gap-10"
        data-erp-route-loading
        style={{ minHeight: 240 }}
      >
        <span className="erp-spinner" aria-hidden style={{ width: 20, height: 20 }} />
        <span className="erp-u-muted erp-u-text-base">불러오는 중...</span>
      </div>
    </RegistrationModalShell>
  );
}
