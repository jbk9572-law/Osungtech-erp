import { describe, expect, it } from "vitest";
import { combinePhone, splitPhone } from "./phone";

describe("splitPhone", () => {
  it("하이픈으로 구분된 전화번호를 3부분으로 나눈다", () => {
    expect(splitPhone("010-1234-5678")).toEqual(["010", "1234", "5678"]);
  });

  it("null/undefined는 빈 문자열 3개로 나눈다", () => {
    expect(splitPhone(null)).toEqual(["", "", ""]);
    expect(splitPhone(undefined)).toEqual(["", "", ""]);
  });

  it("빈 문자열도 빈 문자열 3개로 나눈다", () => {
    expect(splitPhone("")).toEqual(["", "", ""]);
  });
});

describe("combinePhone", () => {
  it("phone1/phone2/phone3 필드를 하이픈으로 합친다", () => {
    const fd = new FormData();
    fd.set("phone1", "010");
    fd.set("phone2", "1234");
    fd.set("phone3", "5678");
    expect(combinePhone(fd)).toBe("010-1234-5678");
  });

  it("일부 칸만 채워져도 채워진 부분만 하이픈으로 합친다", () => {
    const fd = new FormData();
    fd.set("phone1", "010");
    fd.set("phone2", "");
    fd.set("phone3", "5678");
    expect(combinePhone(fd)).toBe("010-5678");
  });

  it("전부 비어있으면 null을 반환한다", () => {
    const fd = new FormData();
    expect(combinePhone(fd)).toBeNull();
  });

  it("namePrefix로 다른 필드셋(fax 등)도 조합할 수 있다", () => {
    const fd = new FormData();
    fd.set("fax1", "02");
    fd.set("fax2", "555");
    fd.set("fax3", "1234");
    expect(combinePhone(fd, "fax")).toBe("02-555-1234");
  });
});
