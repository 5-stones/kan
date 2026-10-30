import { t } from "@lingui/core/macro";
import { useRef, useState } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiXMark,
} from "react-icons/hi2";

import Modal from "~/components/modal";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

const MAX_FILE_BYTES = 5_000_000;

const OUTLINE_BUTTON =
  "rounded-md border border-light-600 px-3 py-2 font-semibold hover:bg-light-200 disabled:opacity-40 dark:border-dark-600 dark:hover:bg-dark-300";

interface ImportResult {
  imported: number;
  errorCount: number;
  errors: { row: number | null; column?: string; message: string }[];
  ignoredColumns: string[];
}

/**
 * Imports contacts from a CSV in the export's format, all or nothing: any error
 * imports nothing and lists every problem, so the user fixes the file and
 * uploads it again. Shows a guide to every column and offers a template.
 */
export function ImportContactsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const utils = api.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const guide = api.coraggio.contacts.importGuide.useQuery(
    { workspacePublicId: workspace.publicId },
    { enabled: isOpen && workspace.publicId.length >= 12 },
  );

  const importCsv = api.coraggio.contacts.importCsv.useMutation({
    onSuccess: async (data) => {
      setResult(data);
      resetFile();
      if (data.imported > 0) {
        await Promise.all([
          utils.board.byId.invalidate(),
          utils.coraggio.boards.nav.invalidate(),
        ]);
      }
    },
    onError: () => setFileError(t`Unable to import contacts. Please try again later.`),
  });

  const resetFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    resetFile();
    setResult(null);
    setFileError(null);
    onClose();
  };

  const downloadTemplate = () => {
    if (!guide.data) return;
    // Prefix a BOM so Excel detects UTF-8
    const blob = new Blob(["﻿", guide.data.template], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!file) return;
    setResult(null);
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(t`The file is too large. Import at most 5 MB at a time.`);
      return;
    }
    importCsv.mutate({
      workspacePublicId: workspace.publicId,
      csv: await file.text(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const hasErrors = Boolean(result && result.errorCount > 0);

  return (
    <Modal
      isVisible={isOpen}
      modalSize="lg"
      positionFromTop="sm"
      closeOnClickOutside={false}
    >
      <div className="import-contacts p-5 text-sm text-light-1000 dark:text-dark-1000">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{t`Import contacts`}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t`Close`}
            className="rounded p-1 hover:bg-light-200 dark:hover:bg-dark-300"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-light-900 dark:text-dark-900">
          {t`Add contacts from a spreadsheet saved as CSV, with the template's columns (a file from Export contacts works too). Nothing is imported unless every row is valid, so you can fix the file and upload it again.`}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={!guide.data}
            className={`${OUTLINE_BUTTON} flex items-center gap-2`}
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
            {t`Download template`}
          </button>
          <label className={`${OUTLINE_BUTTON} cursor-pointer`}>
            {t`Choose CSV file`}
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setFileError(null);
              }}
            />
          </label>
          {file && (
            <span className="min-w-0 truncate text-light-900 dark:text-dark-900">
              {file.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!file || importCsv.isPending}
            className="import-contacts-submit rounded-full bg-primary px-6 py-2 font-semibold text-dark-50 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto"
          >
            {importCsv.isPending ? t`Importing…` : t`Import`}
          </button>
        </div>

        {fileError && (
          <p className="mb-4 text-red-500" role="alert">
            {fileError}
          </p>
        )}

        {result && !hasErrors && (
          <div className="import-contacts-success mb-4 flex items-start gap-2 rounded-md border border-green-600/50 p-3">
            <HiOutlineCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <div>
              <p className="font-semibold">
                {`${t`Contacts imported:`} ${result.imported}`}
              </p>
              {result.ignoredColumns.length > 0 && (
                <p className="text-light-900 dark:text-dark-900">
                  {`${t`Columns ignored:`} ${result.ignoredColumns.join(", ")}`}
                </p>
              )}
            </div>
          </div>
        )}

        {result && hasErrors && (
          <div className="import-contacts-errors mb-4 rounded-md border border-red-500/60 p-3" role="alert">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <HiOutlineExclamationTriangle className="h-5 w-5 shrink-0 text-red-500" />
              {`${t`Nothing was imported. Problems found:`} ${result.errorCount}`}
            </p>
            <p className="mb-2 text-light-900 dark:text-dark-900">
              {t`Fix these in your spreadsheet, save it as CSV and upload the whole file again.`}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {result.errors.map((error, index) => (
                <li key={index} className="break-words">
                  <span className="font-semibold">
                    {[
                      error.row === null
                        ? t`File`
                        : `${t`Row`} ${error.row}`,
                      error.column,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {": "}
                  {error.message}
                </li>
              ))}
            </ul>
            {result.errorCount > result.errors.length && (
              <p className="mt-2 text-light-900 dark:text-dark-900">
                {`${t`More problems not shown:`} ${result.errorCount - result.errors.length}`}
              </p>
            )}
          </div>
        )}

        <details className="import-contacts-guide" open={!hasErrors}>
          <summary className="cursor-pointer select-none font-semibold">
            {t`Columns`}
          </summary>
          <p className="mt-2 text-light-900 dark:text-dark-900">
            {`${t`Only the name is required; leave out columns or cells you don't need. At most this many contacts per file:`} ${guide.data?.maxRows ?? ""}`}
          </p>
          <dl className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {guide.data?.columns.map((column) => (
              <div key={column.header}>
                <dt className="font-semibold">
                  {column.header}
                  {column.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </dt>
                <dd className="text-light-900 dark:text-dark-900">
                  {column.format}
                  {column.allowed?.map((line) => (
                    <span key={line} className="mt-0.5 block text-xs">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Modal>
  );
}
