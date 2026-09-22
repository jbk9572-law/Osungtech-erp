"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type CalendarEventInitial = {
  id?: string;
  title?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
};

export function CalendarEventForm({
  action,
  submitLabel,
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initial?: CalendarEventInitial;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="erp-field md:col-span-2">
        <label htmlFor="cal-title">제목</label>
        <input
          id="cal-title"
          type="text"
          name="title"
          autoComplete="off"
          defaultValue={initial?.title}
          className="erp-input w-full"
          required
        />
      </div>

      <div className="erp-field md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          종일
        </label>
      </div>

      <div className="erp-field">
        <label htmlFor="cal-start-date">시작일</label>
        <input
          id="cal-start-date"
          type="date"
          name="startDate"
          defaultValue={initial?.startDate}
          className="erp-input w-full"
          required
        />
      </div>
      {!allDay && (
        <div className="erp-field">
          <label htmlFor="cal-start-time">시작 시각</label>
          <input
            id="cal-start-time"
            type="time"
            name="startTime"
            defaultValue={initial?.startTime ?? "09:00"}
            className="erp-input w-full"
          />
        </div>
      )}

      <div className="erp-field">
        <label htmlFor="cal-end-date">종료일</label>
        <input
          id="cal-end-date"
          type="date"
          name="endDate"
          defaultValue={initial?.endDate}
          className="erp-input w-full"
        />
      </div>
      {!allDay && (
        <div className="erp-field">
          <label htmlFor="cal-end-time">종료 시각</label>
          <input
            id="cal-end-time"
            type="time"
            name="endTime"
            defaultValue={initial?.endTime ?? "10:00"}
            className="erp-input w-full"
          />
        </div>
      )}

      <div className="erp-field">
        <label htmlFor="cal-location">장소 (선택)</label>
        <input
          id="cal-location"
          type="text"
          name="location"
          autoComplete="off"
          defaultValue={initial?.location}
          className="erp-input w-full"
        />
      </div>

      <div className="erp-field md:col-span-2">
        <label htmlFor="cal-description">내용 (선택)</label>
        <textarea
          id="cal-description"
          name="description"
          rows={3}
          defaultValue={initial?.description}
          className="erp-input w-full"
          style={{ height: "auto", padding: "6px 8px" }}
        />
      </div>

      <div className="erp-field">
        <label aria-hidden="true">&nbsp;</label>
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
          {pending ? "저장 중..." : `F7 ${submitLabel}`}
        </button>
      </div>

      <div className="md:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
