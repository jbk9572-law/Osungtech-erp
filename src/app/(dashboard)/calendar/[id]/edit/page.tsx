import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarEventForm } from "@/components/calendar-event-form";
import { updateCalendarEvent, deleteCalendarEvent } from "@/app/(dashboard)/calendar/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, title, description, location, start_at, end_at, all_day")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const startAt = new Date(event.start_at);
  const endAt = new Date(event.end_at);
  const toDateStr = (d: Date) => d.toLocaleDateString("sv-SE");
  const toTimeStr = (d: Date) => d.toTimeString().slice(0, 5);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/calendar" } }} />
      <ListPageHeader
        title="캘린더 > 일정 수정"
        actions={<CloseButton href="/calendar">ESC 목록으로</CloseButton>}
      />
      <FormSection tabLabel="일정 수정">
        <CalendarEventForm
          action={updateCalendarEvent}
          submitLabel="저장"
          initial={{
            id: event.id,
            title: event.title,
            description: event.description ?? "",
            location: event.location ?? "",
            allDay: event.all_day,
            startDate: toDateStr(startAt),
            startTime: toTimeStr(startAt),
            endDate: toDateStr(endAt),
            endTime: toTimeStr(endAt),
          }}
        />
        <div style={{ marginTop: 12 }}>
          <InlineConfirmDelete
            action={deleteCalendarEvent}
            hiddenFields={{ id: event.id }}
            warningText="이 일정을 삭제하시겠습니까?"
          />
        </div>
      </FormSection>
    </div>
  );
}
