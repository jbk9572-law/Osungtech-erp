// 거래처 발주처럼 "놓치면 안 되는" 알림에만 쓰는 짧은 경고음 — 오디오
// 파일을 따로 두지 않고 Web Audio API로 그 자리에서 짧은 비프음 두 번을
// 만들어 재생한다(자산 추가/네트워크 요청 없이 어디서든 동작).
export function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beepAt = (startDelay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + startDelay;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.start(start);
      osc.stop(start + 0.25);
    };
    beepAt(0);
    beepAt(0.3);
    // 브라우저에 따라 AudioContext가 할 일을 다 하면 자동으로 안 닫히는
    // 경우가 있어, 재생이 끝날 시점에 맞춰 명시적으로 닫아 리소스를 정리한다.
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // 오디오 재생이 막힌 환경(자동재생 정책 등)이면 조용히 포기한다 —
    // 소리는 보조 수단이고, 토스트 자체는 그대로 보인다.
  }
}
