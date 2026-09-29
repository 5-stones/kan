import { t } from "@lingui/core/macro";
import { HiOutlineClock } from "react-icons/hi2";

import Button from "~/components/Button";

export function FollowUpSortToggle({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={enabled ? "follow-up-sort-toggle follow-up-sort-active" : "follow-up-sort-toggle"}>
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={onToggle}
        aria-pressed={enabled}
        iconLeft={
          <HiOutlineClock
            className={
              enabled ? "text-yellow-500" : "text-primary group-hover:text-secondary"
            }
          />
        }
      >
        {enabled ? t`Sorted by follow-up` : t`Sort by follow-up`}
      </Button>
    </div>
  );
}
