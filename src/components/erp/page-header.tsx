import type { ReactNode } from "react";

// 목록+상세 분할뷰(.erp-split-detail)에서 아무것도 선택 안 했을 때 —
// 메일함/문서양식관리/결재선처럼 "고른 걸 보여주는" 화면(할일관리·
// 기안함처럼 미선택 시 바로 작성폼을 띄우는 화면과 다름)은 그동안
// 흰 패널 맨 위에 회색 글자 한 줄("메일을 선택해주세요.")만 덩그러니
// 있어서 "너무 휑하다"는 지적을 받았다(사용자 피드백). 아이콘+안내
// 문구를 패널 한가운데에 놓는 빈 상태를 공용화해서 세 화면이 같이
// 쓴다 — 네 번째로 같은 화면이 생기면 바로 얹으면 된다.
export function SplitDetailEmpty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="erp-split-detail-empty">
      <span className="erp-split-detail-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="erp-split-detail-empty-title">{title}</p>
      {hint && <p className="erp-split-detail-empty-hint">{hint}</p>}
    </div>
  );
}

// 목록/등록 화면 공통 헤더 — 제목이 툴바 위에 단독 줄로 오는 레이아웃.
// 지금까지 화면마다 <h1 className="mb-3 erp-h1">를
// 손으로 반복해서 짰는데, 여백 값이나 클래스가 한 곳만 바뀌고 다른 곳은
// 그대로 남는 식으로 "같은 화면 종류인데 미묘하게 다른" 상태가 되기
// 쉬웠다. 이 레이아웃을 쓰는 화면은 전부 이 컴포넌트만 쓴다.
export function ListPageHeader({
  title,
  actions,
  eyebrow,
  description,
}: {
  title: string;
  actions?: ReactNode;
  // 둘 다 선택값 — 안 넘기면 지금까지와 똑같이 제목 한 줄만 나온다.
  // 기존 36개 호출부를 전부 고치지 않아도 되게 하려고 선택값으로 둠.
  eyebrow?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <>
      {eyebrow && <span className="erp-eyebrow">{eyebrow}</span>}
      <h1 className="mb-3 erp-h1">{title}</h1>
      {description && <p className="erp-page-desc" style={{ marginTop: -8, marginBottom: 12 }}>{description}</p>}
      {actions && <div className="erp-toolbar">{actions}</div>}
    </>
  );
}

// 상세 화면 공통 헤더 — 제목과 툴바가 한 줄에 나란히 오고, 그 아래
// "작성자 · 일시 · 상태" 같은 메타 정보 한 줄이 붙는 레이아웃. title을
// ReactNode로 받는다 — 매출/매입 상세처럼 제목 옆에 반품/샘플/이월
// 뱃지가 붙는 화면이 있어서(문자열만 받으면 이 화면들이 공용 컴포넌트를
// 못 쓰고 손으로 재구현하게 된다), flex 정렬을 기본으로 둬 뱃지가
// 와도 줄바꿈 없이 나란히 붙는다.
export function DetailPageHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  // 상세화면은 거의 항상 뒤로가기/수정 같은 액션이 있지만, 입출고내역처럼
  // 액션 없이 제목+메타만 있는 화면도 있어 선택값으로 둔다.
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="mb-1 erp-detail-header-row">
        <h1 className="flex items-center gap-2 erp-h1">{title}</h1>
        {actions && (
          <div className="erp-toolbar" style={{ marginBottom: 0 }}>
            {actions}
          </div>
        )}
      </div>
      {meta && <p className="mb-4 text-xs text-[var(--erp-text-muted)]">{meta}</p>}
    </>
  );
}

// 상세 패널의 "라벨 · 값" 한 줄짜리 정보행 — sales/[id], purchases/[id]
// 같은 화면이 각각 5번씩 style={{display:"flex",...,minHeight:26,
// marginBottom:8}}을 복붙하고 있던 패턴(헌법검사에서 발견)을 공용화했다.
export function DetailInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, marginBottom: 8 }}>
      <span style={{ width: 72, color: "var(--erp-text-muted)" }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

// 단일 탭짜리 등록/설정 폼을 담는 카드 — erp-detail + erp-detail-tabs +
// erp-detail-body 세 겹 마크업을 화면마다 다시 조립하지 않게 한다. 탭이
// 여러 개인 화면(예: 기안 상세의 "기안 내용"/"결재선")은 이 컴포넌트
// 대신 erp-detail을 여러 번 직접 써서 탭 여러 개를 표현한다.
export function FormSection({ tabLabel, children }: { tabLabel: string; children: ReactNode }) {
  return (
    <div className="erp-detail" style={{ marginTop: 0 }}>
      <div className="erp-detail-tabs">
        <span className="erp-detail-tab active">{tabLabel}</span>
      </div>
      <div className="erp-detail-body">{children}</div>
    </div>
  );
}
