"use client";

// 임시저장(useDraftAutosave)된 입력이 있을 때 보여주는 공용 배너 —
// 매출/매입 등록 등 여러 "전표" 폼에서 똑같이 쓴다.
export function DraftResumeBanner({
  onResume,
  onDiscard,
}: {
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded p-2 text-xs"
      style={{
        background: "var(--erp-warning-bg)",
        color: "var(--erp-warning)",
        border: "1px solid var(--erp-warning-border)",
      }}
    >
      <span>이전에 입력하다 만 내용이 있습니다. 이어서 작성하시겠습니까?</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="erp-btn erp-btn-primary"
          style={{ minWidth: 0, height: 26, padding: "2px 10px", fontSize: 11 }}
          onClick={onResume}
        >
          이어서 작성
        </button>
        <button
          type="button"
          className="erp-btn"
          style={{ minWidth: 0, height: 26, padding: "2px 10px", fontSize: 11 }}
          onClick={onDiscard}
        >
          새로 시작
        </button>
      </div>
    </div>
  );
}
