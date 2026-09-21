"use client";

import { setPlatformAnnouncementActive } from "@/app/platform-admin/announcements/actions";
import { OptimisticCheckbox } from "@/components/grid/optimistic-checkbox";

export function PlatformAnnouncementActiveCheckbox({
  id,
  isActive,
  title,
}: {
  id: string;
  isActive: boolean;
  title: string;
}) {
  return (
    <OptimisticCheckbox
      id={id}
      fieldName="is_active"
      checked={isActive}
      ariaLabel={`${title} 노출`}
      onToggle={setPlatformAnnouncementActive}
    />
  );
}
