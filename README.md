# rbac-permissions-example

A small, tested example of **role-based permissions for a chat server**: a bitfield per role, per-channel overwrites, and a role hierarchy that stops people from promoting themselves.

It is a standalone example written from scratch to show how I approach authorization, not the code of any larger project. Zero runtime dependencies, strict TypeScript, 53 tests.

```ts
import { basePermissions, canModerate, channelPermissions, fromNames } from "./src";

const guild = {
  ownerId: "owner",
  defaultRoleId: "everyone",
  roles: [
    { id: "everyone", position: 0, permissions: fromNames(["VIEW_CHANNEL", "SEND_MESSAGES", "SPEAK"]) },
    { id: "mod", position: 10, permissions: fromNames(["KICK_MEMBERS", "MUTE_MEMBERS"]) },
  ],
};
const alice = { id: "alice", roleIds: ["mod"] };
const dave = { id: "dave", roleIds: [] };

channelPermissions(guild, dave, [
  { roleId: "everyone", allow: 0n, deny: fromNames(["SPEAK"]) }, // read-only channel
]);

canModerate(guild, alice, dave, "KICK"); // { ok: true }
canModerate(guild, dave, alice, "KICK"); // { ok: false, reason: "missing-permission" }
```

## The model

| Piece | What it does |
| --- | --- |
| **Permission bitfield** | Twelve flags in one `bigint`. A role's whole set is one number: cheap to store, compare and combine. |
| **Roles** | Ordered by `position`. Every member implicitly holds the default role (`@everyone`, position 0). A member's base permissions are the union of their roles. |
| **Owner and `ADMINISTRATOR`** | Short-circuit to every permission. Nothing can take them away, including channel overwrites. |
| **Channel overwrites** | Per role, `allow` and `deny`. Applied from the lowest role to the highest, so the higher role wins a disagreement. Without `VIEW_CHANNEL` a member can do nothing in the channel. |
| **Hierarchy** | Assigning or editing a role, and kicking or banning a member, all need a strictly higher rank than the target. |
| **No escalation** | You cannot hand out, or give a role, a permission you do not hold yourself. |
| **Owner protection** | The owner cannot be kicked or banned by anyone. |

## Design decisions

- **`bigint`, not `number`.** A JavaScript number is a 32-bit integer for bitwise operators, so a thirty-third flag would silently wrap. `bigint` removes that ceiling.
- **Highest role wins, in position order.** Some platforms aggregate every `deny` first and then every `allow`, so an allow anywhere wins. Position order is easier to reason about ("the highest role that mentions the flag decides") and is what the tests pin down. It is a choice, not the only correct one.
- **Invariants are checked at the boundary.** `assertGuild` and `assertOverwrites` reject duplicate positions, a missing default role, unknown flags, and overwrites that allow and deny the same flag. The rest of the code can then assume they hold.
- **Stale data is tolerated.** A role id that no longer exists is ignored, so deleting a role never locks a member out.
- **Untrusted input is parsed, not trusted.** `parsePermissions` accepts only a plain decimal string and rejects any bit the model does not define, so an unknown or future flag cannot be smuggled in through a request or a column.
- **Decisions say why.** The checks return `{ ok: false, reason }` (`missing-permission`, `hierarchy`, `escalation`, `target-is-owner`, `self`, `default-role`), so a caller can show a precise message and a test can assert the exact rule that fired.

## Tests

```bash
npm install
npm test          # 53 tests
npm run typecheck
```

What they cover:

- the bitfield: single-bit flags, subset logic, parsing of malformed and out-of-range input;
- base and channel permissions: union of roles, owner and administrator, stale roles, overwrite order, hidden channels;
- the hierarchy: assigning and editing roles, escalation, kick and ban against equal, higher and owner targets;
- two randomized checks with a seeded generator: serialization round-trips, and *an overwrite that only denies never grants more*.

## What this deliberately leaves out

Persistence, caching, per-member overwrites, an audit log and an HTTP layer. The point is the authorization rules, kept as pure functions that are easy to test and to move into a service.

## License

MIT
