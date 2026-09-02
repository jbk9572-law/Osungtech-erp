"use client";

// 표 행 선택용 체크박스는 화면마다 <input type="checkbox">를 직접 써왔는데,
// aria-label을 깜빡 빼먹는 사고가 반복됐다(거래처/공급처 그리드에서 발견돼
// 고쳤지만, 매출/매입/지급결의 그리드에는 똑같이 빠져 있었다). label을
// 선택(optional)이 아니라 필수 prop으로 만들어 컴파일 타임에 강제하면
// 앞으로는 이 실수 자체가 불가능해진다.
export function RowCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
    />
  );
}
