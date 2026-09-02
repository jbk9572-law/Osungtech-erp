"use client";

import { useState, useTransition } from "react";

// 목록 화면에서 "완료 처리"(할일)와 "읽음 처리"(공지사항) 체크박스가
// 낙관적 업데이트+실패 시 되돌리기 로직을 거의 그대로 중복해서 들고
// 있었다. 서버 액션과 필드 이름만 다르므로 한 곳으로 모은다.
export function OptimisticCheckbox({
  id,
  fieldName,
  checked: serverChecked,
  ariaLabel,
  onToggle,
}: {
  id: string;
  fieldName: string;
  checked: boolean;
  ariaLabel: string;
  onToggle: (formData: FormData) => Promise<{ error?: string } | undefined>;
}) {
  const [prevChecked, setPrevChecked] = useState(serverChecked);
  const [checked, setChecked] = useState(serverChecked);
  const [pending, startTransition] = useTransition();

  // revalidatePath로 서버에서 새 값이 내려오면 그대로 따라간다 —
  // 아래 실패 시 되돌리기와 짝을 이뤄, 실제 DB 값과 화면이 항상 같게 한다.
  // (렌더 중 조건부 setState — React가 권장하는 "prop 변경 시 상태 동기화"
  // 방식으로, useEffect보다 한 프레임 먼저 반영돼 깜빡임이 없다.)
  if (serverChecked !== prevChecked) {
    setPrevChecked(serverChecked);
    setChecked(serverChecked);
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        const previous = checked;
        setChecked(!previous);
        const formData = new FormData();
        formData.set("id", id);
        formData.set(fieldName, String(serverChecked));
        startTransition(async () => {
          const result = await onToggle(formData);
          // 실패하면(RLS, 동시 삭제 등) 체크 표시가 실제와 다르게 그대로
          // 남지 않도록 되돌린다.
          if (result?.error) {
            setChecked(previous);
          }
        });
      }}
    />
  );
}
