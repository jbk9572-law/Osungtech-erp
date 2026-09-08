// 화면 상단에 "이 화면을 어떻게 쓰는지" 설명하는 안내문을, 그냥 흐린
// 텍스트가 아니라 눈에 띄는 박스로 통일해서 보여준다. 단순 부제목(날짜,
// SKU, 사업자번호 같은 데이터 표시)에는 쓰지 않는다 — 진짜 사용법 안내에만.
export function PageGuide({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-4 rounded p-2 text-xs ${className}`}
      style={{
        background: "var(--erp-info-bg)",
        color: "var(--erp-info-text)",
        border: "1px solid var(--erp-info-border)",
      }}
    >
      {children}
    </p>
  );
}
