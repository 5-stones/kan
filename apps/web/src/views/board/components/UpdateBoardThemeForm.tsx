import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { useForm } from "react-hook-form";
import { HiXMark } from "react-icons/hi2";
import { z } from "zod";

import Button from "~/components/Button";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { useWorkspace } from "~/providers/workspace";

const schema = z.object({
  themeId: z.string().optional(),
  css: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function UpdateBoardThemeForm({
  boardPublicId,
  themeId,
  themeOverrides,
  isTemplate,
}: {
  boardPublicId: string;
  themeId?: string | null;
  themeOverrides?: Record<string, unknown> | null;
  isTemplate?: boolean;
}) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const { workspace } = useWorkspace();

  const themesQuery = api.theme.list.useQuery({ workspacePublicId: workspace.publicId });

  const {
    register,
    handleSubmit,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      themeId: themeId ?? "",
      css: typeof themeOverrides?.css === "string" ? themeOverrides.css : "",
    },
  });

  const updateBoardTheme = api.board.update.useMutation({
    onSuccess: async () => {
      showPopup({
        header: t`Board theme updated`,
        message: t`Your board theme has been updated.`,
        icon: "success",
      });
      closeModal();
      try {
        await utils.board.all.refetch();
        await utils.board.byId.refetch({ boardPublicId });
      } catch (e) {
        // ignore
      }
    },
    onError: () => {
      showPopup({
        header: t`Unable to update board theme`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    updateBoardTheme.mutate({
      boardPublicId,
      themeId: data.themeId || null,
      themeOverrides: { css: data.css ?? "" },
    });
  };

  return (
    <div className="px-5 pt-5 pb-5">
      <div className="flex w-full items-center justify-between pb-4">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
          {isTemplate ? t`Edit template theme` : t`Edit board theme`}
        </h2>
        <button
          type="button"
          className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
          onClick={closeModal}
        >
          <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">{t`Theme`}</label>
          <select
            {...register("themeId")}
            disabled={themesQuery.isLoading}
            className="w-full rounded-md border border-light-300 p-2 text-sm dark:border-dark-300 dark:bg-dark-200"
          >
            <option value="">{t`Workspace Default`}</option>
            {themesQuery.data?.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">{t`Custom CSS overrides`}</label>
          <textarea
            {...register("css")}
            rows={8}
            className="w-full rounded-md border border-light-300 p-2 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
            placeholder={`.board-header { background: #fff; }\n.card { border-radius: 8px; }`}
          />
          <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
            {t`CSS here is applied on top of the selected theme, overriding any matching rules.`}
          </p>
        </div>

        <div className="border-t border-light-300 pt-4 flex justify-end dark:border-dark-300">
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={updateBoardTheme.isPending}
            isLoading={updateBoardTheme.isPending}
          >
            {t`Update`}
          </Button>
        </div>
      </div>
    </div>
  );
}