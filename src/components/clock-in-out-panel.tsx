"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

type GeoResult = { lat: number; lng: number; accuracyM: number } | null;

// 위치 확인은 GPS 권한이 없거나 실내라 실패할 수 있다 — 그 경우에도
// 출퇴근 체크 자체는 막지 않고, 좌표 없이("위치 확인 안 됨") 그대로
// 진행한다. 8초 넘게 응답이 없으면 포기하고 넘어간다.
function getCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function ClockButton({
  label,
  pendingLabel,
  disabled,
  formRef,
  latRef,
  lngRef,
  accuracyRef,
  onLocating,
  className,
}: {
  label: string;
  pendingLabel: string;
  disabled: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  latRef: React.RefObject<HTMLInputElement | null>;
  lngRef: React.RefObject<HTMLInputElement | null>;
  accuracyRef: React.RefObject<HTMLInputElement | null>;
  onLocating: (locating: boolean) => void;
  className: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={className}
      style={{ width: "100%" }}
      onClick={async () => {
        setBusy(true);
        onLocating(true);
        const geo = await getCurrentPosition();
        if (latRef.current) latRef.current.value = geo ? String(geo.lat) : "";
        if (lngRef.current) lngRef.current.value = geo ? String(geo.lng) : "";
        if (accuracyRef.current) accuracyRef.current.value = geo ? String(geo.accuracyM) : "";
        onLocating(false);
        formRef.current?.requestSubmit();
        setBusy(false);
      }}
    >
      {busy ? pendingLabel : label}
    </button>
  );
}

export function ClockInOutPanel({
  clockedIn,
  clockedOut,
  clockInTime,
  clockOutTime,
  clockInLocation,
  clockOutLocation,
  clockInAction,
  clockOutAction,
}: {
  clockedIn: boolean;
  clockedOut: boolean;
  clockInTime: string | null;
  clockOutTime: string | null;
  clockInLocation?: string | null;
  clockOutLocation?: string | null;
  clockInAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  clockOutAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [inState, inFormAction, inPending] = useActionState(clockInAction, undefined);
  const [outState, outFormAction, outPending] = useActionState(clockOutAction, undefined);
  const [inLocating, setInLocating] = useState(false);
  const [outLocating, setOutLocating] = useState(false);

  const inFormRef = useRef<HTMLFormElement>(null);
  const inLatRef = useRef<HTMLInputElement>(null);
  const inLngRef = useRef<HTMLInputElement>(null);
  const inAccuracyRef = useRef<HTMLInputElement>(null);

  const outFormRef = useRef<HTMLFormElement>(null);
  const outLatRef = useRef<HTMLInputElement>(null);
  const outLngRef = useRef<HTMLInputElement>(null);
  const outAccuracyRef = useRef<HTMLInputElement>(null);

  return (
    <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
      <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
          출근
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{clockInTime ?? "-"}</div>
        <form ref={inFormRef} action={inFormAction}>
          <input ref={inLatRef} type="hidden" name="lat" />
          <input ref={inLngRef} type="hidden" name="lng" />
          <input ref={inAccuracyRef} type="hidden" name="accuracy_m" />
          <ClockButton
            label="출근하기"
            pendingLabel={inLocating ? "위치 확인 중..." : "처리 중..."}
            disabled={clockedIn || inPending}
            formRef={inFormRef}
            latRef={inLatRef}
            lngRef={inLngRef}
            accuracyRef={inAccuracyRef}
            onLocating={setInLocating}
            className="erp-btn erp-btn-primary"
          />
        </form>
        <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--erp-text-muted)" }}>
          {clockInLocation ? `📍 ${clockInLocation}` : "📍 GPS로 위치를 함께 기록합니다(권한을 거부해도 출근 처리는 계속됩니다)."}
        </p>
        <FormMessage state={inState} />
      </div>
      <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
          퇴근
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{clockOutTime ?? "-"}</div>
        <form ref={outFormRef} action={outFormAction}>
          <input ref={outLatRef} type="hidden" name="lat" />
          <input ref={outLngRef} type="hidden" name="lng" />
          <input ref={outAccuracyRef} type="hidden" name="accuracy_m" />
          <ClockButton
            label="퇴근하기"
            pendingLabel={outLocating ? "위치 확인 중..." : "처리 중..."}
            disabled={!clockedIn || clockedOut || outPending}
            formRef={outFormRef}
            latRef={outLatRef}
            lngRef={outLngRef}
            accuracyRef={outAccuracyRef}
            onLocating={setOutLocating}
            className="erp-btn erp-btn-dark"
          />
        </form>
        <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--erp-text-muted)" }}>
          {clockOutLocation ? `📍 ${clockOutLocation}` : "📍 GPS로 위치를 함께 기록합니다(권한을 거부해도 퇴근 처리는 계속됩니다)."}
        </p>
        <FormMessage state={outState} />
      </div>
    </div>
  );
}
