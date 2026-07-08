"use client";

import { useTransition } from "react";
import { toggleTodo } from "@/app/(dashboard)/todos/actions";

export function TodoCheckbox({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={done}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("done", String(done));
        startTransition(() => {
          toggleTodo(formData);
        });
      }}
    />
  );
}
