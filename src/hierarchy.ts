import {
  basePermissions,
  highestPosition,
  isOwner,
  type Guild,
  type Member,
  type Role,
} from "./model";
import { Permission, has, isSubset, type Permissions } from "./permissions";

export type DenyReason =
  | "missing-permission"
  | "hierarchy"
  | "escalation"
  | "target-is-owner"
  | "self"
  | "default-role";

export type Decision = { ok: true } | { ok: false; reason: DenyReason };

const ok: Decision = { ok: true };
const deny = (reason: DenyReason): Decision => ({ ok: false, reason });

/**
 * Having MANAGE_ROLES is not enough to manage every role. Without a hierarchy, a moderator
 * could give themselves an administrator role, or strip the permissions of whoever is above
 * them. The rules, in order:
 *
 * - the actor needs MANAGE_ROLES (ADMINISTRATOR and the owner pass),
 * - the role being touched must sit strictly below the actor's highest role,
 * - the new permission set may not grant anything the actor does not hold.
 *
 * The owner is exempt from the last two: nobody is above them.
 */
export function canAssignRole(
  guild: Guild,
  actor: Member,
  role: Role,
): Decision {
  if (role.id === guild.defaultRoleId) return deny("default-role");
  const perms = basePermissions(guild, actor);
  if (!has(perms, Permission.MANAGE_ROLES)) return deny("missing-permission");
  if (isOwner(guild, actor)) return ok;
  if (role.position >= highestPosition(guild, actor)) return deny("hierarchy");
  // Handing out a role hands out its permissions, so the same ceiling applies.
  if (!isSubset(role.permissions, perms)) return deny("escalation");
  return ok;
}

/** Same ceiling for editing a role: it must be below the actor, and cannot gain new power. */
export function canEditRole(
  guild: Guild,
  actor: Member,
  role: Role,
  nextPermissions: Permissions,
): Decision {
  const perms = basePermissions(guild, actor);
  if (!has(perms, Permission.MANAGE_ROLES)) return deny("missing-permission");
  if (isOwner(guild, actor)) return ok;
  if (role.position >= highestPosition(guild, actor)) return deny("hierarchy");
  if (!isSubset(nextPermissions, perms)) return deny("escalation");
  return ok;
}

export type ModerationAction = "KICK" | "BAN";

const ACTION_PERMISSION: Record<ModerationAction, Permissions> = {
  KICK: Permission.KICK_MEMBERS,
  BAN: Permission.BAN_MEMBERS,
};

/** Kicking or banning needs the permission, a higher rank than the target, and a non-owner. */
export function canModerate(
  guild: Guild,
  actor: Member,
  target: Member,
  action: ModerationAction,
): Decision {
  if (actor.id === target.id) return deny("self");
  if (isOwner(guild, target)) return deny("target-is-owner");
  if (!has(basePermissions(guild, actor), ACTION_PERMISSION[action])) {
    return deny("missing-permission");
  }
  if (isOwner(guild, actor)) return ok;
  if (highestPosition(guild, actor) <= highestPosition(guild, target)) {
    return deny("hierarchy");
  }
  return ok;
}
