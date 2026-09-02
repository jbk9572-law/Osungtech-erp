"use client";

import { toggleTodo } from "@/app/(dashboard)/todos/actions";
import { OptimisticCheckbox } from "@/components/grid/optimistic-checkbox";

export function TodoCheckbox({ id, done, label }: { id: string; done: boolean; label: string }) {
  return (
    <OptimisticCheckbox
      id={id}
      fieldName="done"
      checked={done}
      ariaLabel={`${label} 완료 처리`}
      onToggle={toggleTodo}
    />
  );
}
