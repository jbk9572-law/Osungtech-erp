// 단위별 수량 글자("225 ROLL · 532 KG · 39,420 EA")를 칸 안에서 단위마다 한 줄씩 쌓아 보여준다.
// 한 줄로 길게 이어 붙이면 단위가 많은 합계 줄 때문에 수량 칸이 한없이 넓어져 표가 가로로 밀린다(합계 줄은 거래 전체의 단위가 다 모인다).
// 복사(공유 이미지·엑셀)에서는 글자만 읽으므로 구분자(" · ")를 화면에서만 숨겨 둔 채 글자에는 남긴다.
export function QuantityStack({ text }: { text: string }) {
  const parts = text.split(" · ");
  if (parts.length <= 1) return <>{text}</>;
  return (
    <span className="erp-qty-stack">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="erp-qty-sep"> · </span>}
        </span>
      ))}
    </span>
  );
}
