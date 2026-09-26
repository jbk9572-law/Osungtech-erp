import type { ReactNode } from "react";

// 목록/등록 화면 공통 헤더 — 제목이 툴바 위에 단독 줄로 오는 레이아웃.
// 지금까지 화면마다 <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">를
// 손으로 반복해서 짰는데, 여백 값이나 클래스가 한 곳만 바뀌고 다른 곳은
// 그대로 남는 식으로 "같은 화면 종류인데 미묘하게 다른" 상태가 되기
// 쉬웠다. 이 레이아웃을 쓰는 화면은 전부 이 컴포넌트만 쓴다.
export function ListPageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <>
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">{title}</h1>
      {actions && <div className="erp-toolbar">{actions}</div>}
    </>
  );
}

// 상세 화면 공통 헤더 — 제목과 툴바가 한 줄에 나란히 오고, 그 아래
// "작성자 · 일시 · 상태" 같은 메타 정보 한 줄이 붙는 레이아웃.
export function DetailPageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <>
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{title}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          {actions}
        </div>
      </div>
      {meta && <p className="mb-4 text-xs text-[var(--erp-text-muted)]">{meta}</p>}
    </>
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
