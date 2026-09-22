"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/lib/push-subscription-actions";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// 결재 요청/승인/반려를 브라우저 푸시로 받을지 켜고 끄는 토글. 알림 종
// 드롭다운 하단에 둔다 — 켜져 있으면 이미 이 브라우저에 구독이 있는지
// 마운트 시 확인하고, 없으면 "꺼짐"으로 보여준다. VAPID 공개키가 배포
// 환경변수에 없으면(아직 설정 전) 버튼 자체를 숨긴다.
export function PushSubscribeToggle() {
  const [state, setState] = useState({ supported: false, subscribed: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState({ supported: true, subscribed: !!sub }))
      .catch(() => setState({ supported: true, subscribed: false }));
  }, [publicKey]);

  const { supported, subscribed } = state;

  async function toggle() {
    if (!publicKey) return;
    setBusy(true);
    setError(undefined);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setState((s) => ({ ...s, subscribed: false }));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("브라우저 알림 권한이 거부되었습니다.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const result = await subscribePush(sub.endpoint, json.keys?.p256dh ?? "", json.keys?.auth ?? "");
      if (result.error) {
        setError(result.error);
        await sub.unsubscribe();
        return;
      }
      setState((s) => ({ ...s, subscribed: true }));
    } catch {
      setError("알림 설정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="erp-bell-push-toggle">
      <button type="button" onClick={toggle} disabled={busy}>
        {subscribed ? "🔔 브라우저 알림 끄기" : "🔕 브라우저 알림 켜기"}
      </button>
      {error && <span style={{ color: "var(--erp-danger)", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
