"use client";

import { useTransition } from "react";
import { toggleAnnouncementRead } from "@/app/(dashboard)/announcements/actions";

export function AnnouncementCheckbox({ id, read }: { id: string; read: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={read}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={() => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("read", String(read));
        startTransition(() => {
          toggleAnnouncementRead(formData);
        });
      }}
    />
  );
}
