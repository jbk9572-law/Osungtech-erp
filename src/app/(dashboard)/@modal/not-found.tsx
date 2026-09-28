"use client";

import { useRouter } from "next/navigation";

// @modal 슬롯 전용 404. 목록 화면에서 상세보기를 모달로 여는 인터셉트
// 라우트(@modal/(.)*/[id])에 UUID가 아닌 값이 들어오면 쿼리 없이 바로
// notFound()를 부르는데(src/lib/is-uuid.ts), 이 파일이 없으면 본문
// (목록 화면)은 멀쩡히 떠 있는 채로 그 위에 Next.js 기본 흰 404 화면이
// 뜬금없이 겹쳐 보였다. error.tsx와 마찬가지로 이 슬롯 전용으로 만들어서
// RegistrationModalShell과 같은 모달 오버레이 모습으로 작게 보여준다 —
// 본문 화면은 전혀 건드리지 않는다. 닫기는 /dashboard로 강제 이동하는
// 대신 router.back()으로 열려 있던 목록(필터/페이지 상태 포함)으로
// 그대로 되돌아가게 한다 — RegistrationModalShell의 닫기와 같은 방식.
export default function ModalNotFound() {
  const router = useRouter();
  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div className="erp-modal erp-modal-md" style={{ minHeight: 0 }}>
        <button
          type="button"
          className="erp-modal-window-close"
          onClick={() => router.back()}
          aria-label="닫기"
        >
          ✕
        </button>
        <div className="erp-modal-body" style={{ padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", marginBottom: 8 }}>
            이 항목을 찾을 수 없습니다.
          </p>
          <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 20 }}>
            주소가 바뀌었거나 삭제된 항목일 수 있습니다. 목록 화면은 그대로 있습니다.
          </p>
          <button type="button" onClick={() => router.back()} className="erp-btn erp-btn-primary">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
