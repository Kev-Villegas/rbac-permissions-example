import { describe, expect, it } from "vitest";
import {
  ALL,
  Permission,
  PermissionParseError,
  fromNames,
  has,
  isSubset,
  parsePermissions,
  serializePermissions,
  toNames,
  type PermissionName,
} from "../src";
import { rng } from "./fixtures";

describe("the bitfield", () => {
  it("defines twelve distinct single-bit flags", () => {
    const values = Object.values(Permission);
    expect(values).toHaveLength(12);
    expect(new Set(values).size).toBe(12);
    for (const v of values) expect(v & (v - 1n)).toBe(0n); // one bit each
  });

  it("ALL is the union of every flag", () => {
    expect(toNames(ALL)).toHaveLength(12);
    expect(ALL).toBe((1n << 12n) - 1n);
  });

  it("round-trips through names", () => {
    const names: PermissionName[] = ["VIEW_CHANNEL", "KICK_MEMBERS", "SPEAK"];
    expect(toNames(fromNames(names)).sort()).toEqual([...names].sort());
  });

  it("has() needs every requested bit", () => {
    const set = fromNames(["VIEW_CHANNEL", "SPEAK"]);
    expect(has(set, Permission.SPEAK)).toBe(true);
    expect(has(set, Permission.SPEAK | Permission.CONNECT)).toBe(false);
  });

  it("isSubset() is true only when nothing extra is granted", () => {
    const small = fromNames(["VIEW_CHANNEL"]);
    const big = fromNames(["VIEW_CHANNEL", "SPEAK"]);
    expect(isSubset(small, big)).toBe(true);
    expect(isSubset(big, small)).toBe(false);
    expect(isSubset(0n, 0n)).toBe(true);
  });
});

describe("parsing untrusted input", () => {
  it("accepts a decimal string of known bits", () => {
    expect(parsePermissions("0")).toBe(0n);
    expect(parsePermissions(serializePermissions(ALL))).toBe(ALL);
  });

  it.each([
    ["a negative number", "-1"],
    ["a fraction", "1.5"],
    ["hex", "0xff"],
    ["text", "abc"],
    ["an empty string", ""],
    ["padding", " 1"],
    ["a bit the model does not define", String(1n << 12n)],
    ["an absurdly large value", "9".repeat(30)],
  ])("rejects %s", (_label, input) => {
    expect(() => parsePermissions(input)).toThrow(PermissionParseError);
  });

  it("rejects values that are not strings", () => {
    for (const input of [5, 5n, null, undefined, {}, ["1"]]) {
      expect(() => parsePermissions(input)).toThrow(PermissionParseError);
    }
  });

  it("round-trips any valid set", () => {
    const next = rng(42);
    for (let i = 0; i < 200; i++) {
      const set = BigInt(Math.floor(next() * 4096));
      expect(parsePermissions(serializePermissions(set))).toBe(set);
    }
  });
});
