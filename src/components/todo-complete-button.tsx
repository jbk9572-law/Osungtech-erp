"use client";

import { useState, useTransition } from "react";
import { toggleTodo } from "@/app/(dashboard)/todos/actions";

// 할일 패널의 [완료 처리]/[완료 취소] — 목록 체크박스와 같은 서버 동작(toggleTodo)을 쓴다. 내가 본 상태(done)를 같이 보내 이중 클릭이 되돌리지 않게 한다.
export function TodoCompleteButton({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="erp-btn erp-btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("done", String(done));
            const res = await toggleTodo(fd);
            setError(res?.error ?? null);
          })
        }
      >
        {pending ? "처리 중..." : done ? "완료 취소" : "완료 처리"}
      </button>
      {error && <span className="erp-u-danger erp-u-text-compact">{error}</span>}
    </>
  );
}
