// "이 화면은 관리자만 볼 수 있습니다" 식으로 화면 전체를 벽으로 막는
// 패턴이 adminOnly 화면마다(settings/features, settings/billing 등)
// 똑같은 마크업으로 복붙돼 있었다 — 부서별 접근 제한(department_page_
// access)까지 같은 패턴이 하나 더 늘어나는 시점에 공용 컴포넌트로
// 뽑는다. 기존 adminOnly 화면들은 이미 잘 동작하고 있어 굳이 건드리지
// 않고, 새로 추가하는 화면부터 이걸 쓴다.
export function AccessWall({ title, message }: { title: string; message: string }) {
  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">{title}</h1>
      <p className="erp-grid-empty" style={{ marginTop: 24 }}>
        {message}
      </p>
    </div>
  );
}
