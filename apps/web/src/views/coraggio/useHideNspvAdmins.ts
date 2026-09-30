import { api } from "~/utils/api";

/**
 * NSPV admins are workspace admins of every diocese (internal staff), so they'd
 * otherwise show up as assignees. Returns a filter that drops them from a member
 * list, keeping any already selected (e.g. assigned) so they can be removed.
 */
export function useHideNspvAdmins() {
  const { data: adminEmails } = api.coraggio.admin.nspvAdminEmails.useQuery(
    undefined,
    { staleTime: Infinity },
  );
  const hidden = new Set(adminEmails ?? []);

  return <T extends { publicId: string; email: string }>(
    members: T[],
    keepPublicIds: string[] = [],
  ): T[] =>
    members.filter(
      (member) =>
        !hidden.has(member.email.trim().toLowerCase()) ||
        keepPublicIds.includes(member.publicId),
    );
}
