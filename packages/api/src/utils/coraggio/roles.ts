import type { dbClient } from "@kan/db/client";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import type { Permission } from "@kan/shared";

/**
 * Vocation Directors are workspace "member"s. NSPV admins own the board structure
 * (statuses/columns), so VDs can't create, rename, reorder or delete lists or boards,
 * but they can manage their own team.
 */
export const VD_REVOKED_PERMISSIONS: Permission[] = [
  "list:create",
  "list:edit",
  "list:delete",
  "board:create",
  "board:edit",
  "board:delete",
];

export const VD_GRANTED_PERMISSIONS: Permission[] = [
  "member:invite",
  "member:remove",
];

export async function applyVdRolePermissions(
  db: dbClient,
  workspaceId: number,
) {
  const role = await permissionRepo.getRoleByWorkspaceIdAndName(
    db,
    workspaceId,
    "member",
  );
  if (!role) throw new Error(`Workspace ${workspaceId} has no "member" role`);

  for (const permission of VD_REVOKED_PERMISSIONS) {
    await permissionRepo.revokeRolePermission(db, role.id, permission);
  }
  for (const permission of VD_GRANTED_PERMISSIONS) {
    await permissionRepo.grantRolePermission(db, role.id, permission);
  }
}
