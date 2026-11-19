import { formatKstTime } from "@/lib/kst-date";

// 임시저장이 기록된 시각을 폼 위에 작게 보여준다(예: "임시저장 14:31"). 값이 없으면 아무것도 그리지 않는다.
// 표시 여부는 테마 토큰(--erp-draft-indicator-display) — 클래식은 숨김. 매출/매입 등록 폼이 같이 쓴다.
export function DraftSavedIndicator({ savedAt }: { savedAt: number | null }) {
  if (!savedAt) return null;
  return (
    <div className="erp-draft-indicator" role="status">
      임시저장 {formatKstTime(new Date(savedAt), { hour: "2-digit", minute: "2-digit", hour12: false })}
    </div>
  );
}
