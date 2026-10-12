import { ALL, NONE, Permission, has, type Permissions } from "./permissions";

/** A role. `position` orders roles; the default (@everyone) role sits at 0. */
export interface Role {
  readonly id: string;
  readonly position: number;
  readonly permissions: Permissions;
}

/** A per-channel adjustment for one role. `allow` and `deny` must not overlap. */
export interface Overwrite {
  readonly roleId: string;
  readonly allow: Permissions;
  readonly deny: Permissions;
}

export interface Member {
  readonly id: string;
  readonly roleIds: readonly string[];
}

export interface Guild {
  readonly ownerId: string;
  /** The role every member has implicitly. */
  readonly defaultRoleId: string;
  readonly roles: readonly Role[];
}

export class InvalidGuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGuildError";
  }
}

/**
 * The invariants the rest of the code relies on, checked once at the boundary instead of
 * defensively inside every function. Call it when a guild is loaded or changed.
 */
export function assertGuild(guild: Guild): void {
  const ids = new Set<string>();
  const positions = new Set<number>();
  for (const role of guild.roles) {
    if (ids.has(role.id)) {
      throw new InvalidGuildError(`duplicate role id "${role.id}"`);
    }
    if (!Number.isInteger(role.position) || role.position < 0) {
      throw new InvalidGuildError(`role "${role.id}" has an invalid position`);
    }
    if (positions.has(role.position)) {
      throw new InvalidGuildError(
        `two roles share position ${role.position}; their order would be ambiguous`,
      );
    }
    if ((role.permissions & ~ALL) !== 0n) {
      throw new InvalidGuildError(`role "${role.id}" has an unknown flag`);
    }
    ids.add(role.id);
    positions.add(role.position);
  }
  const base = guild.roles.find((r) => r.id === guild.defaultRoleId);
  if (!base) throw new InvalidGuildError("the default role is missing");
  if (base.position !== 0) {
    throw new InvalidGuildError("the default role must be at position 0");
  }
}

export function assertOverwrites(overwrites: readonly Overwrite[]): void {
  const seen = new Set<string>();
  for (const ow of overwrites) {
    if (seen.has(ow.roleId)) {
      throw new InvalidGuildError(`two overwrites for role "${ow.roleId}"`);
    }
    seen.add(ow.roleId);
    if ((ow.allow & ow.deny) !== 0n) {
      throw new InvalidGuildError(
        `overwrite for role "${ow.roleId}" both allows and denies the same flag`,
      );
    }
  }
}

export const isOwner = (guild: Guild, member: Member): boolean =>
  guild.ownerId === member.id;

/**
 * The roles a member holds, lowest position first. The default role is always included.
 * A role id that no longer exists (a deleted role) is ignored rather than failing: stale
 * assignments are normal and must not lock anyone out.
 */
export function rolesOf(guild: Guild, member: Member): Role[] {
  const wanted = new Set([guild.defaultRoleId, ...member.roleIds]);
  return guild.roles
    .filter((role) => wanted.has(role.id))
    .sort((a, b) => a.position - b.position);
}

/** The highest position a member holds. The owner outranks every role. */
export function highestPosition(guild: Guild, member: Member): number {
  if (isOwner(guild, member)) return Number.POSITIVE_INFINITY;
  const roles = rolesOf(guild, member);
  return roles.length === 0 ? 0 : roles[roles.length - 1]!.position;
}

/**
 * What a member can do in the guild before any channel adjustment: the union of their
 * roles. The owner and anyone with ADMINISTRATOR get everything.
 */
export function basePermissions(guild: Guild, member: Member): Permissions {
  if (isOwner(guild, member)) return ALL;
  let set = NONE;
  for (const role of rolesOf(guild, member)) set |= role.permissions;
  return has(set, Permission.ADMINISTRATOR) ? ALL : set;
}

/**
 * What a member can do in one channel.
 *
 * Overwrites are applied from the lowest role to the highest, so the higher role wins when
 * two roles disagree. For each role: its `deny` bits are cleared, then its `allow` bits are
 * set. A member who cannot VIEW_CHANNEL can do nothing in it.
 */
export function channelPermissions(
  guild: Guild,
  member: Member,
  overwrites: readonly Overwrite[] = [],
): Permissions {
  const base = basePermissions(guild, member);
  if (has(base, Permission.ADMINISTRATOR)) return ALL;

  const byRole = new Map(overwrites.map((ow) => [ow.roleId, ow] as const));
  let set = base;
  for (const role of rolesOf(guild, member)) {
    const ow = byRole.get(role.id);
    if (ow) set = (set & ~ow.deny) | ow.allow;
  }
  return has(set, Permission.VIEW_CHANNEL) ? set : NONE;
}
