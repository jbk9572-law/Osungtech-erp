// 입력해도 되는 값이 헷갈리는 필드에 다는 물음표 힌트. 새 기능이 아니라
// 이미 있는 동작(예: 지급결의 빠른등록의 자동 월별 묶음)을 설명해주는
// 용도라, 정말 헷갈리는 필드에만 제한적으로 붙인다.
export function FieldHint({ text }: { text: string }) {
  return (
    <span className="erp-hint-dot" title={text} aria-label={text}>
      ?
    </span>
  );
}
