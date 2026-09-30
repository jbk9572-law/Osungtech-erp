import { describe, expect, it } from "vitest";
import { extractTemplateFields, renderTemplate, htmlToPlainText } from "./document-template";

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

  it("body는 HTML로 렌더링되므로, 치환하는 값의 HTML 특수문자는 이스케이프한다", () => {
    expect(renderTemplate("<p>{{name}}</p>", { name: '<script>alert(1)</script>' })).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
    );
    expect(renderTemplate("{{company}}", { company: "A&B" })).toBe("A&amp;B");
  });
});

describe("htmlToPlainText", () => {
  it("블록 태그 경계를 줄바꿈으로, 나머지 태그는 제거해 일반 텍스트로 바꾼다", () => {
    expect(htmlToPlainText("<p>첫 줄</p><p>둘째 줄</p>")).toBe("첫 줄\n둘째 줄");
  });

  it("태그가 없는 순수 텍스트는 그대로 둔다", () => {
    expect(htmlToPlainText("그냥 텍스트")).toBe("그냥 텍스트");
  });
});
