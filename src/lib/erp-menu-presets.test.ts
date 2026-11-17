import { describe, expect, it } from "vitest";
import { BEHAVIOR_FEATURE_KEYS, INDUSTRY_PRESETS, MENU_GROUPS, MENU_TOGGLE_LOCKED_HREFS } from "./erp-menu";

// 업종 템플릿이 가리키는 키가 실제 메뉴에 있는지, 끄기/켜기가 서로 부딪히지 않는지 — 오타 하나로 템플릿이 조용히 무력해지는 걸 막는다.
const KNOWN_KEYS = new Set<string>([
  ...MENU_GROUPS.flatMap((g) => [g.featureKey, ...g.items.flatMap((i) => [i.featureKey, i.href])]).filter((k): k is string => !!k),
  ...BEHAVIOR_FEATURE_KEYS.map((b) => b.key),
]);

describe("INDUSTRY_PRESETS", () => {
  it("키가 중복되지 않는다", () => {
    const keys = INDUSTRY_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const preset of INDUSTRY_PRESETS) {
    it(`${preset.label}: 모든 키가 실제 메뉴/기능 키다`, () => {
      for (const k of [...preset.disable, ...preset.enable]) expect(KNOWN_KEYS.has(k), `알 수 없는 키: ${k}`).toBe(true);
    });
    it(`${preset.label}: 끄기와 켜기가 겹치지 않고, 항상 켜져 있어야 하는 메뉴를 끄지 않는다`, () => {
      expect(preset.disable.filter((k) => preset.enable.includes(k))).toEqual([]);
      expect(preset.disable.filter((k) => MENU_TOGGLE_LOCKED_HREFS.has(k))).toEqual([]);
    });
  }
});
