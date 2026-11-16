import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";

// 등록/상세 모달(인터셉트 라우트)이 열리는 동안 내용이 도착하기 전에 보여주는 모달 모양 로딩 화면.
// 각 인터셉트 폴더(@modal/(.)xxx/loading.tsx)가 이 컴포넌트를 그대로 내보낸다 — @modal 최상위에 두면
// 모달과 상관없는 일반 메뉴 이동에서도 같은 칸이 바뀔 때마다 모달 모양이 번쩍였다(check-modal-loading.mjs가 구조를 지킨다).
export default function ModalLoading() {
  return (
    <RegistrationModalShell size="xl">
      {/* data-erp-route-loading: route-progress-bar.tsx가 이 마커로 "주소는 바뀌었지만 아직 이 자리엔 로딩 화면뿐"임을
          구분하고, 이 마커가 모달 안에 있는 동안은 뒤쪽 "이동 중..." 오버레이를 숨긴다(erp-theme.css) — 로딩은 한 곳만 보인다. */}
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
