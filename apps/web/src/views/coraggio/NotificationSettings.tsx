import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";

import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { getBrowserTimeZone } from "./useSyncDigestTimeZone";

const US_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Mountain (Arizona)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Puerto_Rico", label: "Atlantic (Puerto Rico)" },
];

/**
 * Global opt-out for automated emails (follow-up reminders, assignments,
 * mentions) and the time zone of the ~7am follow-up digest.
 */
export default function NotificationSettings() {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const { data, isLoading } = api.coraggio.settings.get.useQuery();
  // Read after mount: the server's time zone would mismatch on hydration
  const [browserTimeZone, setBrowserTimeZone] = useState<string | null>(null);
  useEffect(() => setBrowserTimeZone(getBrowserTimeZone()), []);

  const update = api.coraggio.settings.update.useMutation({
    onMutate: async (input) => {
      await utils.coraggio.settings.get.cancel();
      const previous = utils.coraggio.settings.get.getData();
      if (previous) {
        utils.coraggio.settings.get.setData(undefined, { ...previous, ...input });
      }
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
  const timeZone = data?.timeZone ?? browserTimeZone ?? "America/New_York";
  const timeZones = US_TIME_ZONES.some((zone) => zone.value === timeZone)
    ? US_TIME_ZONES
    : [{ value: timeZone, label: timeZone.replace(/_/g, " ") }, ...US_TIME_ZONES];

  return (
    <div className="mb-8 border-t border-light-300 dark:border-dark-300">
      <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
        {t`Email notifications`}
      </h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-dark-900">
        {t`Automated emails include a daily list of today's follow-ups, a reminder when a follow-up is overdue, being assigned to a contact by someone else, and @mentions in comments. Invitations, sign-in and account security emails are always sent.`}
      </p>
      <Toggle
        label={t`Send me automated emails`}
        labelPosition="after"
        isChecked={enabled}
        disabled={isLoading || update.isPending}
        onChange={() => update.mutate({ emailNotificationsEnabled: !enabled })}
      />

      <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
        {t`Time zone`}
      </h2>
      <p className="mb-4 text-sm text-neutral-500 dark:text-dark-900">
        {t`Your list of today's follow-ups is sent around 7am in this time zone.`}
      </p>
      <div className="mb-4 flex w-full max-w-[325px] items-center gap-2">
        <select
          value={timeZone}
          onChange={(e) => update.mutate({ timeZone: e.target.value })}
          disabled={isLoading || update.isPending}
          className="block w-full rounded-md border-0 bg-dark-300 bg-white/5 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-light-600 placeholder:text-dark-800 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700 dark:focus:ring-dark-700 sm:leading-6"
        >
          {timeZones.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
