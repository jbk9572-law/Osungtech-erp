import type { ReactNode } from "react";

// D형(설정 폼) 화면의 공용 부품 — 시안: 섹션 카드 + 12칸 격자 + 라벨은 칸 위.
// 모양은 모던 테마에서만 카드로 보이고(erp-theme.css의 .erp-settings-*), 클래식은 구역 제목만 있는 단순 배치다.
export function SettingsPage({ children }: { children: ReactNode }) {
  return <div className="erp-settings-page">{children}</div>;
}

export function SettingsSection({
  title,
  hint,
  danger,
  children,
}: {
  title: string;
  hint?: string;
  /** 위험 영역(초기화·삭제 등) — 빨간 테두리로 맨 아래에 따로 둔다. */
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`erp-settings-card${danger ? " is-danger" : ""}`}>
      <header className="erp-settings-card-head">
        <h3>{title}</h3>
        {hint && <small>{hint}</small>}
      </header>
      <div className="erp-field-grid erp-settings-grid">{children}</div>
    </section>
  );
}

// 하단 고정 저장 바 — 저장 버튼 + 상태 메시지(오류 건수 등)를 한 줄에 둔다.
export function SettingsSaveBar({ children }: { children: ReactNode }) {
  return <div className="erp-settings-savebar">{children}</div>;
}
