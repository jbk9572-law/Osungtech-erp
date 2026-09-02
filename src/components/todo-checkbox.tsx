"use client";

import { useState, useTransition } from "react";
import { toggleTodo } from "@/app/(dashboard)/todos/actions";

export function TodoCheckbox({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [prevDone, setPrevDone] = useState(done);
  const [checked, setChecked] = useState(done);
  const [pending, startTransition] = useTransition();

  // revalidatePath로 서버에서 새 done 값이 내려오면 그대로 따라간다 —
  // 아래 실패 시 되돌리기와 짝을 이뤄, 실제 DB 값과 화면이 항상 같게 한다.
  // (렌더 중 조건부 setState — React가 권장하는 "prop 변경 시 상태 동기화"
  // 방식으로, useEffect보다 한 프레임 먼저 반영돼 깜빡임이 없다.)
  if (done !== prevDone) {
    setPrevDone(done);
    setChecked(done);
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      aria-label={`${label} 완료 처리`}
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        const previous = checked;
        setChecked(!previous);
        const formData = new FormData();
        formData.set("id", id);
        formData.set("done", String(done));
        startTransition(async () => {
          const result = await toggleTodo(formData);
          // 실패하면(RLS, 동시 삭제 등) 체크 표시가 실제와 다르게 그대로
          // 남지 않도록 되돌린다 — 이전엔 이 결과를 확인하지 않아서 실패해도
          // 체크만 계속 눌려 보이는 문제가 있었다.
          if (result?.error) {
            setChecked(previous);
          }
        });
      }}
    />
  );
}
