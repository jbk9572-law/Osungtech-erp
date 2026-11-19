"use client";

// 매출/매입 품목 줄 단가 칸 아래의 "직접입력" 체크박스 — 켜면 거래처 단가표/최근가 자동입력 대신 직접 단가를 입력한다.
// 끄면(자동입력으로 되돌림) 호출한 쪽이 최근가를 다시 채운다(onChange(false)). 두 등록 폼이 같은 모양을 쓰게 한 곳에서 그린다.
export function ManualPriceToggle({ checked, onChange }: { checked: boolean; onChange: (manual: boolean) => void }) {
  return (
    <label className="mt-1 flex items-center justify-end gap-1 text-[10.5px] erp-u-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      직접입력
    </label>
  );
}
