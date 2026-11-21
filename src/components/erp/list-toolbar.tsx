import type { ReactNode } from "react";

// A형 목록 상단의 도구 줄(시안) — 왼쪽: 조회·신규·수정·삭제 같은 작업 버튼 | 구분선 | 엑셀·열 설정 같은 도구, 오른쪽: "14:32 조회 · 거래처 48곳 | 선택 1곳" 상태.
// 버튼 자체는 화면이 만든다(링크·폼 제출·비활성 상태가 화면마다 다르므로) — 이 부품은 줄의 모양과 자리만 정한다(개발헌법 3번).
export function ListToolbar({ actions, tools, status }: { actions: ReactNode; tools?: ReactNode; status?: ReactNode }) {
  return (
    <div className="erp-listtoolbar" role="toolbar" aria-label="목록 작업">
      <div className="erp-listtoolbar-actions">{actions}</div>
      {tools && (
        <>
          <span className="erp-listtoolbar-sep" aria-hidden />
          <div className="erp-listtoolbar-actions">{tools}</div>
        </>
      )}
      {status && <div className="erp-listtoolbar-status">{status}</div>}
    </div>
  );
}

/** 버튼 안에 쓰는 단축키 표시(F5·F2 …) — 눌러서 되는 키만 적는다. */
export function ToolbarKey({ children }: { children: ReactNode }) {
  return <kbd className="erp-listtoolbar-key">{children}</kbd>;
}
