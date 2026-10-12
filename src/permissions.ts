/**
 * Permissions are a bitfield held in a bigint: one bit per capability, so a role's whole
 * permission set is a single number that is cheap to store, compare and combine.
 * bigint rather than number, so the set can grow past 31 bits without silently wrapping.
 */
export const Permission = {
  VIEW_CHANNEL: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  CONNECT: 1n << 2n,
  SPEAK: 1n << 3n,
  MANAGE_MESSAGES: 1n << 4n,
  MUTE_MEMBERS: 1n << 5n,
  KICK_MEMBERS: 1n << 6n,
  BAN_MEMBERS: 1n << 7n,
  MANAGE_CHANNELS: 1n << 8n,
  MANAGE_ROLES: 1n << 9n,
  CREATE_INVITE: 1n << 10n,
  ADMINISTRATOR: 1n << 11n,
} as const;

export type PermissionName = keyof typeof Permission;
export type Permissions = bigint;

export const NONE: Permissions = 0n;
export const ALL: Permissions = Object.values(Permission).reduce(
  (acc, bit) => acc | bit,
  0n,
);

/** True when every bit of `flag` is set in `set`. */
export const has = (set: Permissions, flag: Permissions): boolean =>
  (set & flag) === flag;

export const add = (set: Permissions, flag: Permissions): Permissions =>
  set | flag;

export const remove = (set: Permissions, flag: Permissions): Permissions =>
  set & ~flag;

/** True when `candidate` grants nothing that `of` does not already grant. */
export const isSubset = (candidate: Permissions, of: Permissions): boolean =>
  (candidate & ~of) === 0n;

export function fromNames(names: readonly PermissionName[]): Permissions {
  return names.reduce((acc, name) => acc | Permission[name], 0n);
}

export function toNames(set: Permissions): PermissionName[] {
  return (Object.keys(Permission) as PermissionName[]).filter((name) =>
    has(set, Permission[name]),
  );
}

export class PermissionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionParseError";
  }
}

/** bigint is not JSON-serializable, so a set travels and is stored as a decimal string. */
export const serializePermissions = (set: Permissions): string =>
  set.toString(10);

/**
 * Reads a permission set from untrusted input (a request body, a database column).
 * Accepts only a plain decimal string and rejects any bit this model does not define,
 * so an unknown or future flag can never be smuggled in.
 */
export function parsePermissions(input: unknown): Permissions {
  if (typeof input !== "string" || !/^\d{1,20}$/.test(input)) {
    throw new PermissionParseError(
      "permissions must be a non-negative decimal string",
    );
  }
  const value = BigInt(input);
  if ((value & ~ALL) !== 0n) {
    throw new PermissionParseError("permissions contain an unknown flag");
  }
  return value;
}
