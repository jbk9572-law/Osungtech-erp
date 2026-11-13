import { describe, expect, it } from "vitest";
import { isSafeMailHost, isSafeMailPort } from "./host-guard";

describe("isSafeMailHost", () => {
  it("일반 메일 서비스 도메인은 허용한다", () => {
    for (const h of ["imap.daum.net", "smtp.gmail.com", "mail.example.co.kr", "IMAP.NAVER.COM"]) {
      expect(isSafeMailHost(h)).toBe(true);
    }
  });
  it("내부망/로컬/메타데이터 주소와 비정상 형식은 거부한다", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1",
      "foo.internal", "db.local", "x.localhost", "[::1]", "a.com:993", "a.com/path", "", "2130706433", "evil", "a b.com"]) {
      expect(isSafeMailHost(h)).toBe(false);
    }
  });
});

describe("isSafeMailPort", () => {
  it("메일 표준 포트만 허용한다", () => {
    expect(isSafeMailPort(993)).toBe(true);
    expect(isSafeMailPort(465)).toBe(true);
    expect(isSafeMailPort(22)).toBe(false);
    expect(isSafeMailPort(6379)).toBe(false);
    expect(isSafeMailPort(993.5)).toBe(false);
  });
});
