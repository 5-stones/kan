import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { useRouter } from "next/router";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";

import { useDebounce } from "~/hooks/useDebounce";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

interface ContactResult {
  publicId: string;
  title: string;
  listName: string;
  boardName: string;
  matchedField: string | null;
}

/** Contact search by name or any detail (email, phone, parish, ...), per the mockup header. */
export function HeaderSearch() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query.trim(), 250);

  const { data, isFetching } = api.coraggio.contacts.search.useQuery(
    { workspacePublicId: workspace.publicId, query: debouncedQuery },
    {
      enabled: Boolean(workspace.publicId && debouncedQuery.length > 0),
      placeholderData: (previous) => previous,
    },
  );
  const results: ContactResult[] = debouncedQuery ? (data ?? []) : [];
  const showResults = query.trim().length > 0;

  return (
    <div className="coraggio-header-search relative w-full md:w-[22rem]">
      <Combobox<ContactResult | null>
        value={null}
        onChange={(result) => {
          if (!result) return;
          setQuery("");
          void router.push(`/cards/${result.publicId}`);
        }}
      >
        <div className="relative">
          <ComboboxInput
            className="coraggio-header-search-input h-[2.3rem] w-full rounded-full border border-border bg-transparent pl-4 pr-10 text-sm text-text placeholder:text-textMuted focus:border-primary focus:ring-0 dark:border-borderDark dark:text-textDark dark:placeholder:text-textMutedDark"
            placeholder={t`Search contacts`}
            aria-label={t`Search contacts`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
          />
          <HiMagnifyingGlass
            className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-textMuted dark:text-textMutedDark"
            aria-hidden="true"
          />
        </div>
        {showResults && (
          <ComboboxOptions
            static
            className="coraggio-header-search-results absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-md border border-border bg-background py-1 text-sm shadow-lg dark:border-borderDark dark:bg-backgroundDark"
          >
            {results.map((result) => (
              <ComboboxOption
                key={result.publicId}
                value={result}
                className="cursor-pointer px-4 py-2 data-[focus]:bg-light-200 dark:data-[focus]:bg-dark-300"
              >
                <div className="font-medium text-text dark:text-textDark">
                  {result.title}
                </div>
                <div className="truncate text-xs text-textMuted dark:text-textMutedDark">
                  {result.listName}
                  {result.matchedField &&
                  !result.title.toLowerCase().includes(debouncedQuery.toLowerCase())
                    ? ` · ${result.matchedField}`
                    : ""}
                </div>
              </ComboboxOption>
            ))}
            {results.length === 0 && (
              <div className="px-4 py-2 text-textMuted dark:text-textMutedDark">
                {isFetching || query.trim() !== debouncedQuery
                  ? t`Searching…`
                  : t`No contacts found`}
              </div>
            )}
          </ComboboxOptions>
        )}
      </Combobox>
    </div>
  );
}
