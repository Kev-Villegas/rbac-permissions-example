import { describe, expect, it } from "vitest";
import {
  Permission,
  canAssignRole,
  canEditRole,
  canModerate,
  fromNames,
} from "../src";
import {
  admin,
  alice,
  bob,
  carol,
  dave,
  erin,
  everyone,
  guild,
  lead,
  mod,
  owner,
  risky,
} from "./fixtures";

const ok = { ok: true };
const denied = (reason: string) => ({ ok: false, reason });

describe("assigning a role", () => {
  it("allows a manager to hand out a role below them", () => {
    expect(canAssignRole(guild, bob, mod)).toEqual(ok);
  });

  it("needs MANAGE_ROLES", () => {
    expect(canAssignRole(guild, alice, mod)).toEqual(
      denied("missing-permission"),
    );
  });

  it("refuses a role at the actor's own rank or above", () => {
    expect(canAssignRole(guild, bob, lead)).toEqual(denied("hierarchy"));
    expect(canAssignRole(guild, bob, admin)).toEqual(denied("hierarchy"));
  });

  it("refuses a lower role that carries power the actor does not hold", () => {
    expect(risky.position).toBeLessThan(lead.position);
    expect(canAssignRole(guild, bob, risky)).toEqual(denied("escalation"));
  });

  it("never hands out the default role", () => {
    expect(canAssignRole(guild, owner, everyone)).toEqual(
      denied("default-role"),
    );
  });

  it("lets the owner assign any other role", () => {
    for (const role of [mod, lead, admin, risky]) {
      expect(canAssignRole(guild, owner, role)).toEqual(ok);
    }
  });
});

describe("editing a role", () => {
  it("allows narrowing or keeping power within the actor's own set", () => {
    const next = fromNames(["MANAGE_MESSAGES", "BAN_MEMBERS"]);
    expect(canEditRole(guild, bob, mod, next)).toEqual(ok);
  });

  it("refuses to grant a flag the actor does not hold", () => {
    const next = mod.permissions | Permission.ADMINISTRATOR;
    expect(canEditRole(guild, bob, mod, next)).toEqual(denied("escalation"));
  });

  it("refuses to edit a role at or above the actor", () => {
    expect(canEditRole(guild, bob, lead, 0n)).toEqual(denied("hierarchy"));
    expect(canEditRole(guild, bob, admin, 0n)).toEqual(denied("hierarchy"));
  });

  it("needs MANAGE_ROLES", () => {
    expect(canEditRole(guild, alice, risky, 0n)).toEqual(
      denied("missing-permission"),
    );
  });
});

describe("moderating a member", () => {
  it("allows a higher rank to kick a lower one", () => {
    expect(canModerate(guild, alice, dave, "KICK")).toEqual(ok);
    expect(canModerate(guild, carol, bob, "KICK")).toEqual(ok);
  });

  it("refuses an equal rank", () => {
    expect(canModerate(guild, alice, erin, "KICK")).toEqual(
      denied("hierarchy"),
    );
  });

  it("refuses a higher rank", () => {
    expect(canModerate(guild, alice, bob, "KICK")).toEqual(denied("hierarchy"));
  });

  it("needs the specific permission for the action", () => {
    expect(canModerate(guild, alice, dave, "BAN")).toEqual(
      denied("missing-permission"),
    );
    expect(canModerate(guild, bob, alice, "BAN")).toEqual(ok);
  });

  it("protects the owner from everyone, including administrators", () => {
    for (const actor of [alice, bob, carol]) {
      expect(canModerate(guild, actor, owner, "BAN")).toEqual(
        denied("target-is-owner"),
      );
    }
  });

  it("refuses acting on yourself", () => {
    expect(canModerate(guild, bob, bob, "KICK")).toEqual(denied("self"));
  });

  it("lets the owner moderate anyone else", () => {
    for (const target of [alice, bob, carol, dave]) {
      expect(canModerate(guild, owner, target, "BAN")).toEqual(ok);
    }
  });
});
