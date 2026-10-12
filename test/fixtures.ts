import { fromNames, type Guild, type Member, type Role } from "../src";

/** A small server: an owner, three ranks of staff and an ordinary member. */
export const everyone: Role = {
  id: "everyone",
  position: 0,
  permissions: fromNames(["VIEW_CHANNEL", "SEND_MESSAGES", "CONNECT", "SPEAK"]),
};
export const mod: Role = {
  id: "mod",
  position: 10,
  permissions: fromNames(["MANAGE_MESSAGES", "MUTE_MEMBERS", "KICK_MEMBERS"]),
};
export const lead: Role = {
  id: "lead",
  position: 20,
  permissions: fromNames([
    "MANAGE_MESSAGES",
    "MUTE_MEMBERS",
    "KICK_MEMBERS",
    "BAN_MEMBERS",
    "MANAGE_CHANNELS",
    "MANAGE_ROLES",
  ]),
};
export const admin: Role = {
  id: "admin",
  position: 30,
  permissions: fromNames(["ADMINISTRATOR"]),
};
/** Sits below `lead` but carries a flag `lead` does not hold. */
export const risky: Role = {
  id: "risky",
  position: 5,
  permissions: fromNames(["ADMINISTRATOR"]),
};

export const guild: Guild = {
  ownerId: "owner",
  defaultRoleId: "everyone",
  roles: [everyone, mod, lead, admin, risky],
};

export const member = (id: string, ...roleIds: string[]): Member => ({
  id,
  roleIds,
});

export const owner = member("owner");
export const alice = member("alice", "mod");
export const erin = member("erin", "mod"); // same rank as alice
export const bob = member("bob", "lead");
export const carol = member("carol", "admin");
export const dave = member("dave");

/** A tiny seeded generator, so the randomized tests are repeatable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
