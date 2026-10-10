import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

// "이 화면은 관리자만 볼 수 있습니다" 식으로 화면 전체를 벽으로 막는
// 패턴이 adminOnly 화면마다(settings/features, settings/billing 등)
// 똑같은 마크업으로 복붙돼 있었다 — 부서별 접근 제한(department_page_
// access)까지 같은 패턴이 하나 더 늘어나는 시점에 공용 컴포넌트로
// 뽑는다. 기존 adminOnly 화면들은 이미 잘 동작하고 있어 굳이 건드리지
// 않고, 새로 추가하는 화면부터 이걸 쓴다.
//
// backHref — 이 벽만 단독으로 화면 전체를 대신 그리는 페이지(보통
// `if (차단) return <AccessWall .../>`로 그 페이지의 정상 렌더 경로에
// 있던 <KeyboardShortcuts>까지 같이 건너뛴다)에서, ESC로 돌아갈 곳을
// 명시적으로 넘긴다 — 안 넘기면 ESC 단축키 자체가 등록되지 않아 "ESC가
// 안 먹는다"는 버그가 된다(사용자가 실제로 겪고 지적한 문제).
export function AccessWall({ title, message, backHref }: { title: string; message: string; backHref?: string }) {
  return (
    <div>
      {backHref && <KeyboardShortcuts shortcuts={{ Escape: { href: backHref } }} />}
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">{title}</h1>
      <p className="erp-grid-empty" style={{ marginTop: 24 }}>
        {message}
      </p>
    </div>
  );
}
