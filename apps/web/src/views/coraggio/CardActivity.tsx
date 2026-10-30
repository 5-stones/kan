import { t } from "@lingui/core/macro";

import { useWorkspace } from "~/providers/workspace";
import ActivityList from "../card/components/ActivityList";

/**
 * Activity log of a contact, without comments. Sits in the right panel on
 * desktop and at the bottom of the page on phones (where the panel is inline).
 */
export function CardActivity({ cardPublicId }: { cardPublicId: string }) {
  const { workspace } = useWorkspace();

  return (
    <div className="card-detail-activity">
      <h2 className="text-md pb-4 font-medium text-text dark:text-textDark">
        {t`Activity log`}
      </h2>
      <ActivityList
        cardPublicId={cardPublicId}
        isLoading={false}
        isAdmin={workspace.role === "admin"}
        hideComments
      />
    </div>
  );
}
