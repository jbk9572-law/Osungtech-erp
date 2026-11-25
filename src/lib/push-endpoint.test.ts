import { describe, expect, it } from "vitest";
import { isSafePushEndpoint } from "./push-endpoint";

describe("isSafePushEndpoint", () => {
  it("브라우저 푸시 서비스 주소는 허용", () => {
    expect(isSafePushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isSafePushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isSafePushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isSafePushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  });
  it("그 밖의 주소(사내망·IP·http·비슷한 이름·계정정보 포함)는 거부", () => {
    for (const u of ["http://fcm.googleapis.com/x", "https://intranet.local/x", "https://10.0.0.5/x", "https://fcm.googleapis.com.evil.com/x", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "not a url", ""]) {
      expect(isSafePushEndpoint(u)).toBe(false);
    }
  });
});
