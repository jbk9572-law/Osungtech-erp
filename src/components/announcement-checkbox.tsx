"use client";

import { toggleAnnouncementRead } from "@/app/(dashboard)/announcements/actions";
import { OptimisticCheckbox } from "@/components/grid/optimistic-checkbox";

export function AnnouncementCheckbox({ id, read, label }: { id: string; read: boolean; label: string }) {
  return (
    <OptimisticCheckbox
      id={id}
      fieldName="read"
      checked={read}
      ariaLabel={`${label} 읽음 처리`}
      onToggle={toggleAnnouncementRead}
    />
  );
}
