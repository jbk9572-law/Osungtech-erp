"use client";

import { useState, useTransition } from "react";
import { toggleAnnouncementRead } from "@/app/(dashboard)/announcements/actions";

export function AnnouncementCheckbox({ id, read, label }: { id: string; read: boolean; label: string }) {
  const [prevRead, setPrevRead] = useState(read);
  const [checked, setChecked] = useState(read);
  const [pending, startTransition] = useTransition();

  // 렌더 중 조건부 setState — React가 권장하는 "prop 변경 시 상태 동기화"
  // 방식(useEffect보다 한 프레임 먼저 반영돼 깜빡임이 없다).
  if (read !== prevRead) {
    setPrevRead(read);
    setChecked(read);
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      aria-label={`${label} 읽음 처리`}
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        const previous = checked;
        setChecked(!previous);
        const formData = new FormData();
        formData.set("id", id);
        formData.set("read", String(read));
        startTransition(async () => {
          const result = await toggleAnnouncementRead(formData);
          if (result?.error) {
            setChecked(previous);
          }
        });
      }}
    />
  );
}
