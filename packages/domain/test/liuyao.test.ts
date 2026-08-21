import { describe, expect, it } from "vitest";
import { calculateLiuyao, castLiuyaoFromCoins } from "../src/liuyao";

const baseCast = {
  question: "这件事接下来如何推进？",
  method: "manual_lines" as const,
  lineOrder: "bottom_to_top" as const,
  castAt: "1990-05-18T12:00:00+08:00",
  timeZone: "Asia/Shanghai",
  locationName: "上海市",
};

describe("liuyao deterministic calculation", () => {
  it("builds a static Qian hexagram with bottom-to-top NaJia and palace relations", () => {
    const result = calculateLiuyao({
      schemaVersion: 1,
      cast: { ...baseCast, lines: [7, 7, 7, 7, 7, 7] },
    });

    expect(result.hexagram.base).toMatchObject({
      key: 63,
      name: "乾",
      palace: { name: "乾宫", element: "metal", position: "本宫" },
    });
    expect(result.hexagram.changed).toMatchObject({ key: 63, name: "乾" });
    expect(result.lines.map((line) => line.branch)).toEqual(["子", "寅", "辰", "午", "申", "戌"]);
    expect(result.lines.map((line) => line.stem)).toEqual(["甲", "甲", "甲", "壬", "壬", "壬"]);
    expect(result.lines.every((line) => line.changedYinYang === "阳")).toBe(true);
    expect(result.lines.filter((line) => line.isShi).map((line) => line.position)).toEqual([6]);
    expect(result.lines.filter((line) => line.isYing).map((line) => line.position)).toEqual([3]);
    expect(result.context).toMatchObject({
      localDate: "1990-05-18",
      day: { ganZhiIndex: 19, name: "癸未" },
      xunKong: ["申", "酉"],
    });
    expect(result.lines[4].isVoid).toBe(true);
    expect(result.evidence.map((item) => item.ruleId)).toEqual(result.ruleIds);
  });

  it("flips moving lines into the changed hexagram while preserving static lines", () => {
    const result = calculateLiuyao({
      schemaVersion: 1,
      cast: { ...baseCast, lines: [9, 7, 8, 6, 7, 8] },
    });

    expect(result.hexagram.base).toMatchObject({ key: 19, name: "节" });
    expect(result.hexagram.changed).toMatchObject({ key: 26, name: "困" });
    expect(result.lines.map((line) => line.moving)).toEqual([true, false, false, true, false, false]);
    expect(result.lines.map((line) => line.changedYinYang)).toEqual(["阴", "阳", "阴", "阳", "阳", "阴"]);
  });

  it("reconstructs six lines from an auditable 18-draw coin record", () => {
    const draws = Array.from({ length: 18 }, () => 2) as unknown as
      Parameters<typeof castLiuyaoFromCoins>[0]["randomAudit"]["draws"];
    const result = castLiuyaoFromCoins({
      ...baseCast,
      method: "coins",
      randomAudit: { algorithm: "test:coin", nonce: "nonce-1", draws },
    });

    expect(result.cast.lines).toEqual([6, 6, 6, 6, 6, 6]);
    expect(result.hexagram.base.name).toBe("坤");
    expect(result.hexagram.changed.name).toBe("乾");
    expect(result.lines.every((line) => line.moving && line.changedYinYang === "阳")).toBe(true);
  });

  it("rejects a coin audit whose line values were altered", () => {
    expect(() => calculateLiuyao({
      schemaVersion: 1,
      cast: {
        ...baseCast,
        method: "coins",
        lines: [7, 7, 7, 7, 7, 7],
        randomAudit: {
          algorithm: "test:coin",
          nonce: "nonce-2",
          draws: Array.from({ length: 18 }, () => 2),
        },
      },
    })).toThrow("硬币原始记录与爻值不一致");
  });

  it("maps all 64 static hexagrams without falling back to an unknown name", () => {
    for (let key = 0; key < 64; key += 1) {
      const lines = Array.from({ length: 6 }, (_, index) => ((key >> index) & 1) === 1 ? 7 : 8) as [7, 7, 7, 7, 7, 7];
      const result = calculateLiuyao({
        schemaVersion: 1,
        cast: { ...baseCast, lines },
      });
      expect(result.hexagram.base.key, `key-${key}`).toBe(key);
      expect(result.hexagram.changed.key, `key-${key}`).toBe(key);
      expect(result.hexagram.base.name, `key-${key}`).not.toMatch(/^卦/);
      expect(result.lines.every((line) => !line.moving), `key-${key}`).toBe(true);
    }
  });

  it("keeps a published S3 example's prose/table discrepancy explicit", () => {
    // Source: https://github.com/ShousenZHANG/chinese-fortune/blob/main/references/04-liuyao.md
    // The source is an engineering cross-check only; it is not a traditional-rule authority.
    const result = calculateLiuyao({
      schemaVersion: 1,
      cast: {
        ...baseCast,
        castAt: "1903-09-04T12:00:00+08:00",
        lines: [8, 8, 6, 7, 7, 7],
      },
    });

    // The source prose names 火地晋→火山旅, while its line table encodes
    // 天地否→天山遯. We preserve the table as raw input and do not promote it.
    expect(result.hexagram.base).toMatchObject({ key: 56, name: "否", palace: { name: "乾宫", position: "三世" } });
    expect(result.hexagram.changed).toMatchObject({ key: 60, name: "遯" });
    expect(result.lines.map((line) => line.branch)).toEqual(["未", "巳", "卯", "午", "申", "戌"]);
    expect(result.lines.map((line) => line.sixRelative)).toEqual(["父母", "官鬼", "妻财", "官鬼", "兄弟", "父母"]);
    expect(result.lines.filter((line) => line.moving).map((line) => line.position)).toEqual([3]);
    expect(result.context).toMatchObject({ localDate: "1903-09-04", monthBranch: "申", day: { name: "乙未" } });
  });
});
