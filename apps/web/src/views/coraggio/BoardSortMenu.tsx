import { Menu, Transition } from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { Fragment } from "react";
import { HiArrowsUpDown, HiCheck } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import type { BoardSortKey } from "./useBoardSort";

/** Icon-only sort button for the board header; "manual order" turns sorting off. */
export function BoardSortMenu({
  sortKey,
  onChange,
  disabled,
}: {
  sortKey: BoardSortKey | null;
  onChange: (sortKey: BoardSortKey | null) => void;
  disabled?: boolean;
}) {
  const options: { key: BoardSortKey | null; label: string }[] = [
    { key: "alphabetical", label: t`Alphabetical` },
    { key: "followUp", label: t`Follow-up date` },
    { key: "lastContact", label: t`Last contact` },
    { key: null, label: t`Manual order` },
  ];

  return (
    <Menu
      as="div"
      className={twMerge(
        "board-sort-menu relative inline-block text-left",
        sortKey && "board-sort-active",
      )}
    >
      <Menu.Button
        disabled={disabled}
        aria-label={t`Sort`}
        title={t`Sort`}
        className={twMerge(
          "group inline-flex h-9 w-9 items-center justify-center rounded-md border-[1px] border-border bg-background text-light-1000 shadow-sm focus-visible:outline-none dark:border-borderDark dark:bg-backgroundDark dark:text-dark-1000",
          disabled && "opacity-60",
        )}
      >
        <HiArrowsUpDown
          className={
            sortKey ? "text-yellow-500" : "text-primary group-hover:text-secondary"
          }
        />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-[100] mt-2 w-48 origin-top-right rounded-md border border-border bg-surface p-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-borderDark dark:bg-surfaceDark">
          {options.map((option) => (
            <Menu.Item key={option.key ?? "manual"}>
              <button
                type="button"
                onClick={() => onChange(option.key)}
                className="flex w-full items-center gap-2 rounded-[5px] p-2 text-left text-[12px] text-dark-900 hover:bg-light-200 dark:hover:bg-dark-300"
              >
                <HiCheck
                  className={twMerge(
                    "h-[14px] w-[14px] shrink-0",
                    sortKey === option.key ? "visible" : "invisible",
                  )}
                  aria-hidden="true"
                />
                {option.label}
              </button>
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
