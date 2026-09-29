import { t } from "@lingui/core/macro";

import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

/** Global opt-out for automated emails (follow-up reminders, assignments, mentions). */
export default function NotificationSettings() {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const { data, isLoading } = api.coraggio.settings.get.useQuery();

  const update = api.coraggio.settings.update.useMutation({
    onMutate: async (input) => {
      await utils.coraggio.settings.get.cancel();
      const previous = utils.coraggio.settings.get.getData();
      utils.coraggio.settings.get.setData(undefined, input);
      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.coraggio.settings.get.setData(undefined, context?.previous);
      showPopup({
        header: t`Unable to update notification settings`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: () => utils.coraggio.settings.get.invalidate(),
  });

  const enabled = data?.emailNotificationsEnabled ?? true;

  return (
    <div className="mb-8 border-t border-light-300 dark:border-dark-300">
      <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
        {t`Email notifications`}
      </h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-dark-900">
        {t`Automated emails include follow-up date reminders, being assigned to a contact by someone else, and @mentions in comments. Invitations and sign-in emails are always sent.`}
      </p>
      <Toggle
        label={t`Send me automated emails`}
        labelPosition="after"
        isChecked={enabled}
        disabled={isLoading || update.isPending}
        onChange={() => update.mutate({ emailNotificationsEnabled: !enabled })}
      />
    </div>
  );
}
