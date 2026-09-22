import { CalendarEventForm } from "@/components/calendar-event-form";
import { createCalendarEvent } from "@/app/(dashboard)/calendar/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";

export default function NewCalendarEventPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/calendar" } }} />
      <ListPageHeader
        title="캘린더 > 새 일정"
        actions={<CloseButton href="/calendar">ESC 목록으로</CloseButton>}
      />
      <FormSection tabLabel="일정 등록">
        <CalendarEventForm action={createCalendarEvent} submitLabel="등록" />
      </FormSection>
    </div>
  );
}
