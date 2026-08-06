import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Button from "~/components/Button";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

const schema = z.object({
  themeId: z.string().optional(),
  imports: z.string().optional(),
  css: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const UpdateWorkspaceThemeForm = ({
  workspacePublicId,
  themeId,
  themeOverrides,
  disabled = false,
}: {
  workspacePublicId: string;
  themeId?: string | null;
  themeOverrides?: Record<string, unknown> | null;
  disabled?: boolean;
}) => {
  const utils = api.useUtils();
  const { showPopup } = usePopup();

  const themesQuery = api.theme.list.useQuery({ workspacePublicId }, { enabled: !disabled });
  const runtimeThemesQuery = api.theme.runtime.useQuery(undefined, { enabled: !disabled });

  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      themeId: themeId || "",
      imports: typeof themeOverrides?.imports === "string" ? themeOverrides.imports : "",
      css: typeof themeOverrides?.css === "string" ? themeOverrides.css : "",
    },
  });

  const updateWorkspaceTheme = api.workspace.update.useMutation({
    onSuccess: async () => {
      showPopup({
        header: t`Workspace theme updated`,
        message: t`Your workspace theme has been updated.`,
        icon: "success",
      });
      try {
        await utils.workspace.all.refetch();
        await utils.workspace.byId.refetch({ workspacePublicId });
      } catch (e) {
        console.error(e);
      }
    },
    onError: () => {
      showPopup({
        header: t`Error updating workspace theme`,
        message: t`Please try again later.`,
        icon: "error",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    updateWorkspaceTheme.mutate({
      workspacePublicId,
      themeId: data.themeId || null,
      themeOverrides: { css: data.css, imports: data.imports },
    });
  };

  return (
    <div className="flex flex-col gap-4 max-w-[500px]">
      <div>
        <label className="text-sm font-medium mb-1 block">{t`Theme`}</label>
        <select
          {...register("themeId")}
          disabled={disabled || themesQuery.isLoading}
          className="w-full rounded-md border border-light-300 p-2 text-sm dark:border-dark-300 dark:bg-dark-200"
        >
          <option value="">{t`None / Default`}</option>
          {runtimeThemesQuery.data && Object.keys(runtimeThemesQuery.data).length > 0 && (
            <optgroup label={t`Built-in`}>
              {Object.entries(runtimeThemesQuery.data).map(([key, theme]) => (
                <option key={key} value={key}>
                  {(theme as { name?: string } | null)?.name || key}
                </option>
              ))}
            </optgroup>
          )}
          {themesQuery.data && themesQuery.data.length > 0 && (
            <optgroup label={t`Custom`}>
              {themesQuery.data.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">{t`Font import overrides`}</label>
        <textarea
          {...register("imports")}
          disabled={disabled}
          rows={2}
          className="w-full rounded-md border border-light-300 p-2 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
          placeholder={`https://fonts.googleapis.com/css2?family=Roboto`}
        />
        <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
          {t`One URL or \`@import\` statement per line.`}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">{t`Custom CSS overrides`}</label>
        <textarea
          {...register("css")}
          disabled={disabled}
          rows={8}
          className="w-full rounded-md border border-light-300 p-2 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
          placeholder={`.board-header { background: #fff; }\n.card { border-radius: 8px; }`}
        />
        <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
          {t`CSS here is applied on top of the selected theme, overriding any matching rules.`}
        </p>
      </div>

      {isDirty && !disabled && (
        <div>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="primary"
            disabled={updateWorkspaceTheme.isPending}
            isLoading={updateWorkspaceTheme.isPending}
          >
            {t`Update Theme`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UpdateWorkspaceThemeForm;