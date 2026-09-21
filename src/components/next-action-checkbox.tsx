"use client";

import { useTransition } from "react";
import { toggleActivityNextActionDone } from "@/app/(dashboard)/sales-activities/actions";

export function NextActionCheckbox({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("done", String(e.target.checked));
        startTransition(() => {
          toggleActivityNextActionDone(formData);
        });
      }}
      aria-label="팔로우업 완료 처리"
    />
  );
}
