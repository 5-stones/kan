import { HiPlus } from "react-icons/hi2";

import { Tooltip } from "~/components/Tooltip";

/** Gold circular "+" in the board header that opens the new contact form. */
export function NewContactButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="new-contact-button flex h-9 w-9 items-center justify-center rounded-full bg-primary text-dark-50 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <HiPlus className="h-5 w-5" strokeWidth={1} />
      </button>
    </Tooltip>
  );
}
