import { describe, expect, it } from "vitest";
import {
  ALL,
  InvalidGuildError,
  NONE,
  Permission,
  assertGuild,
  assertOverwrites,
  basePermissions,
  channelPermissions,
  fromNames,
  has,
  highestPosition,
  isSubset,
  type Guild,
  type Overwrite,
} from "../src";
import {
  alice,
  bob,
  carol,
  dave,
  everyone,
  guild,
  lead,
  member,
  mod,
  owner,
  rng,
} from "./fixtures";

describe("base permissions", () => {
  it("gives a member with no roles the default role only", () => {
    expect(basePermissions(guild, dave)).toBe(everyone.permissions);
  });

  it("is the union of the default role and the member's roles", () => {
    expect(basePermissions(guild, alice)).toBe(
      everyone.permissions | mod.permissions,
    );
  });

  it("gives the owner everything, whatever their roles", () => {
    expect(basePermissions(guild, owner)).toBe(ALL);
  });

  it("gives ADMINISTRATOR everything", () => {
    expect(basePermissions(guild, carol)).toBe(ALL);
  });

  it("ignores a role that no longer exists", () => {
    const stale = member("zed", "deleted-role", "mod");
    expect(basePermissions(guild, stale)).toBe(
      everyone.permissions | mod.permissions,
    );
  });

  it("ranks the owner above every role", () => {
    expect(highestPosition(guild, owner)).toBe(Number.POSITIVE_INFINITY);
    expect(highestPosition(guild, bob)).toBe(lead.position);
    expect(highestPosition(guild, dave)).toBe(0);
  });
});

describe("channel permissions", () => {
  const speak = Permission.SPEAK;

  it("equals the base permissions when there are no overwrites", () => {
    expect(channelPermissions(guild, alice)).toBe(basePermissions(guild, alice));
  });

  it("lets an overwrite deny what the role grants", () => {
    const ow: Overwrite[] = [{ roleId: "everyone", allow: NONE, deny: speak }];
    expect(has(channelPermissions(guild, dave, ow), speak)).toBe(false);
  });

  it("lets an overwrite grant what the role lacks", () => {
    const ow: Overwrite[] = [
      { roleId: "mod", allow: Permission.MANAGE_CHANNELS, deny: NONE },
    ];
    expect(
      has(channelPermissions(guild, alice, ow), Permission.MANAGE_CHANNELS),
    ).toBe(true);
    expect(
      has(channelPermissions(guild, dave, ow), Permission.MANAGE_CHANNELS),
    ).toBe(false);
  });

  it("lets the higher role win when two roles disagree", () => {
    // @everyone denies SPEAK, mod allows it back: a mod can speak, anyone else cannot.
    const ow: Overwrite[] = [
      { roleId: "everyone", allow: NONE, deny: speak },
      { roleId: "mod", allow: speak, deny: NONE },
    ];
    expect(has(channelPermissions(guild, alice, ow), speak)).toBe(true);
    expect(has(channelPermissions(guild, dave, ow), speak)).toBe(false);

    // The reverse: a lower role cannot undo a higher role's denial.
    const reverse: Overwrite[] = [
      { roleId: "everyone", allow: speak, deny: NONE },
      { roleId: "mod", allow: NONE, deny: speak },
    ];
    expect(has(channelPermissions(guild, alice, reverse), speak)).toBe(false);
  });

  it("gives nothing to someone who cannot view the channel", () => {
    const hidden: Overwrite[] = [
      { roleId: "everyone", allow: NONE, deny: Permission.VIEW_CHANNEL },
    ];
    expect(channelPermissions(guild, dave, hidden)).toBe(NONE);
  });

  it("does not let overwrites touch an administrator or the owner", () => {
    const lockout: Overwrite[] = [
      { roleId: "everyone", allow: NONE, deny: ALL },
      { roleId: "admin", allow: NONE, deny: ALL },
    ];
    expect(channelPermissions(guild, carol, lockout)).toBe(ALL);
    expect(channelPermissions(guild, owner, lockout)).toBe(ALL);
  });

  it("never grants more when an overwrite only denies (randomized)", () => {
    const next = rng(7);
    const roleIds = ["everyone", "mod", "lead", "admin"];
    for (let i = 0; i < 300; i++) {
      const who = member(
        `u${i}`,
        ...roleIds.filter(() => next() > 0.5),
      );
      const ow: Overwrite[] = roleIds
        .filter(() => next() > 0.5)
        .map((roleId) => ({
          roleId,
          allow: NONE,
          deny: BigInt(Math.floor(next() * 4096)),
        }));
      const before = channelPermissions(guild, who);
      const after = channelPermissions(guild, who, ow);
      expect(isSubset(after, before)).toBe(true);
    }
  });
});

describe("invariants at the boundary", () => {
  it("accepts a well-formed guild", () => {
    expect(() => assertGuild(guild)).not.toThrow();
  });

  it("rejects two roles at the same position", () => {
    const bad: Guild = {
      ...guild,
      roles: [...guild.roles, { ...mod, id: "twin" }],
    };
    expect(() => assertGuild(bad)).toThrow(InvalidGuildError);
  });

  it("rejects a missing default role", () => {
    const bad: Guild = { ...guild, defaultRoleId: "nope" };
    expect(() => assertGuild(bad)).toThrow(/default role is missing/);
  });

  it("rejects a default role that is not at position 0", () => {
    const bad: Guild = {
      ...guild,
      roles: guild.roles.map((r) =>
        r.id === "everyone" ? { ...r, position: 1 } : r,
      ),
    };
    expect(() => assertGuild(bad)).toThrow(/position 0/);
  });

  it("rejects a role with a flag the model does not define", () => {
    const bad: Guild = {
      ...guild,
      roles: [...guild.roles, { id: "x", position: 99, permissions: 1n << 20n }],
    };
    expect(() => assertGuild(bad)).toThrow(/unknown flag/);
  });

  it("rejects an overwrite that allows and denies the same flag", () => {
    const flag = fromNames(["SPEAK"]);
    expect(() =>
      assertOverwrites([{ roleId: "mod", allow: flag, deny: flag }]),
    ).toThrow(/both allows and denies/);
  });

  it("rejects two overwrites for one role", () => {
    expect(() =>
      assertOverwrites([
        { roleId: "mod", allow: NONE, deny: NONE },
        { roleId: "mod", allow: NONE, deny: NONE },
      ]),
    ).toThrow(/two overwrites/);
  });
});
