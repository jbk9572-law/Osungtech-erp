import { describe, expect, it } from "vitest";
import { extractTemplateFields, renderTemplate } from "./document-template";

describe("extractTemplateFields", () => {
  it("본문에서 {{필드명}}을 중복 없이 순서대로 뽑는다", () => {
    expect(extractTemplateFields("{{company_name}}과 {{employee_name}}은 {{company_name}}에서")).toEqual([
      "company_name",
      "employee_name",
    ]);
  });

  it("필드가 없으면 빈 배열을 반환한다", () => {
    expect(extractTemplateFields("그냥 텍스트")).toEqual([]);
  });
});

describe("renderTemplate", () => {
  it("필드를 값으로 치환한다", () => {
    expect(renderTemplate("{{a}}와 {{b}}", { a: "1", b: "2" })).toBe("1와 2");
  });

  it("값이 없는 필드는 빈 문자열로 치환한다", () => {
    expect(renderTemplate("{{a}}{{b}}", { a: "1" })).toBe("1");
  });
});
