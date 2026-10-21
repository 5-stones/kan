import { useEffect, useRef } from "react";

import { api } from "~/utils/api";

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Saves the browser's time zone for the daily follow-up digest the first time a
 * signed-in user loads the app. Once set, it's only changed from Settings →
 * Notifications.
 */
export function useSyncDigestTimeZone(enabled: boolean) {
  const attempted = useRef(false);
  const utils = api.useUtils();
  const { data } = api.coraggio.settings.get.useQuery(undefined, { enabled });
  const update = api.coraggio.settings.update.useMutation({
    onSuccess: (settings) => utils.coraggio.settings.get.setData(undefined, settings),
  });

  useEffect(() => {
    if (!data || data.timeZone || attempted.current) return;
    const timeZone = getBrowserTimeZone();
    if (!timeZone) return;

    attempted.current = true;
    update.mutate({ timeZone });
  }, [data, update]);
}
