import { t } from "@lingui/core/macro";
import { useState } from "react";

import { CORAGGIO_APP_NAME } from "@kan/shared";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { PageHead } from "~/components/PageHead";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

const sectionClass = "mb-10 border-t border-light-300 pt-8 dark:border-dark-300";
const headingClass =
  "mb-2 text-[14px] font-bold text-neutral-900 dark:text-dark-1000";
const helpClass = "mb-6 text-sm text-neutral-500 dark:text-dark-900";
const labelClass = "mb-1 block text-sm font-medium text-neutral-900 dark:text-dark-1000";

function parseEmails(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function OnboardDioceseForm() {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const { data: templates } = api.coraggio.admin.listTemplateBoards.useQuery();

  const [name, setName] = useState("");
  const [boardName, setBoardName] = useState(CORAGGIO_APP_NAME);
  const [templateBoardPublicId, setTemplateBoardPublicId] = useState("");
  const [vdEmails, setVdEmails] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const onboard = api.coraggio.admin.onboardDiocese.useMutation({
    onSuccess: (data) => {
      const failed = data.invites.filter((invite) => !invite.invited);
      setResult(
        failed.length
          ? t`Diocese created, but ${failed.length} invite(s) failed: ${failed.map((f) => f.email).join(", ")}`
          : t`Diocese created and ${data.invites.length} VD invite(s) sent.`,
      );
      setName("");
      setVdEmails("");
      void utils.coraggio.admin.listWorkspaces.invalidate();
    },
    onError: (error) =>
      showPopup({
        header: t`Unable to onboard diocese`,
        message: error.message,
        icon: "error",
      }),
  });

  const selectedTemplate = templateBoardPublicId || templates?.[0]?.publicId || "";

  return (
    <form
      className="max-w-[36rem] space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        onboard.mutate({
          name,
          boardName,
          templateBoardPublicId: selectedTemplate,
          vdEmails: parseEmails(vdEmails),
        });
      }}
    >
      <div>
        <label className={labelClass} htmlFor="diocese-name">
          {t`Diocese name`}
        </label>
        <Input
          id="diocese-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t`Diocese of Springfield`}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="board-name">
          {t`Board name`}
        </label>
        <Input
          id="board-name"
          value={boardName}
          onChange={(event) => setBoardName(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="template">
          {t`Template board`}
        </label>
        <select
          id="template"
          className="block w-full rounded-md border-0 bg-dark-300 bg-white/5 py-1.5 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700"
          value={selectedTemplate}
          onChange={(event) => setTemplateBoardPublicId(event.target.value)}
          required
        >
          {!templates?.length && <option value="">{t`No template boards found`}</option>}
          {templates?.map((template) => (
            <option key={template.publicId} value={template.publicId}>
              {template.name} ({template.workspaceName})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500 dark:text-dark-900">
          {t`Statuses, labels, custom fields and theme are copied from this template.`}
        </p>
      </div>
      <div>
        <label className={labelClass} htmlFor="vd-emails">
          {t`Vocation Director emails`}
        </label>
        <textarea
          id="vd-emails"
          rows={3}
          className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700"
          value={vdEmails}
          onChange={(event) => setVdEmails(event.target.value)}
          placeholder="vocations@diocese.org, assistant@diocese.org"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-dark-900">
          {t`Separate with commas or new lines. Each receives an invitation email.`}
        </p>
      </div>
      <Button type="submit" disabled={onboard.isPending || !selectedTemplate}>
        {onboard.isPending ? t`Onboarding…` : t`Onboard diocese`}
      </Button>
      {result && <p className="text-sm text-neutral-700 dark:text-dark-1000">{result}</p>}
    </form>
  );
}

function WorkspaceList() {
  const { showPopup } = usePopup();
  const { data: workspaces, isLoading } = api.coraggio.admin.listWorkspaces.useQuery();
  const applyDefaults = api.coraggio.admin.applyDefaults.useMutation({
    onSuccess: () =>
      showPopup({
        header: t`Defaults applied`,
        message: t`VD role restrictions and NSPV admin membership are up to date.`,
        icon: "success",
      }),
    onError: (error) =>
      showPopup({ header: t`Unable to apply defaults`, message: error.message, icon: "error" }),
  });

  if (isLoading) return <p className={helpClass}>{t`Loading…`}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-neutral-900 dark:text-dark-1000">
        <thead className="text-neutral-500 dark:text-dark-900">
          <tr>
            <th className="py-2 pr-4 font-medium">{t`Workspace`}</th>
            <th className="py-2 pr-4 font-medium">{t`Boards`}</th>
            <th className="py-2 pr-4 font-medium">{t`Members`}</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {workspaces?.map((workspace) => {
            const active = workspace.members.filter((m) => m.status === "active").length;
            const invited = workspace.members.filter((m) => m.status === "invited").length;
            return (
              <tr key={workspace.publicId} className="border-t border-light-300 dark:border-dark-300">
                <td className="py-2 pr-4">{workspace.name}</td>
                <td className="py-2 pr-4">
                  {workspace.boards
                    .filter((board) => board.type === "regular")
                    .map((board) => board.name)
                    .join(", ") || "—"}
                </td>
                <td className="py-2 pr-4">
                  {active}
                  {invited ? ` (+${invited} ${t`invited`})` : ""}
                </td>
                <td className="py-2 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={applyDefaults.isPending}
                    onClick={() =>
                      applyDefaults.mutate({ workspacePublicId: workspace.publicId })
                    }
                  >
                    {t`Apply Coraggio defaults`}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** NSPV admin tools: interim diocese onboarding and workspace overview. */
export default function AdminView() {
  const { data, isLoading } = api.coraggio.admin.me.useQuery();

  return (
    <div className="h-full overflow-y-auto">
      <PageHead title={t`NSPV Admin`} />
      <div className="m-auto max-w-[1100px] px-5 py-6 md:px-28 md:py-12">
        <h1 className="mb-8 font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
          {t`NSPV Admin`}
        </h1>
        {isLoading ? null : !data?.isAdmin ? (
          <p className={helpClass}>{t`You don't have access to this page.`}</p>
        ) : (
          <>
            <section className={sectionClass}>
              <h2 className={headingClass}>{t`Onboard a diocese`}</h2>
              <p className={helpClass}>
                {t`Creates a workspace for the diocese with a board copied from a template. NSPV admins are added as workspace admins, and the Vocation Directors are invited as members who can manage contacts and their team, but not the board's statuses.`}
              </p>
              <OnboardDioceseForm />
            </section>
            <section className={sectionClass}>
              <h2 className={headingClass}>{t`Dioceses`}</h2>
              <p className={helpClass}>
                {t`"Apply Coraggio defaults" re-applies the VD role restrictions and adds any NSPV admins who aren't members yet.`}
              </p>
              <WorkspaceList />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
