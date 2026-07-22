import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import Head from "next/head";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  HiOutlinePencil,
  HiOutlinePlusSmall,
  HiOutlineTrash,
  HiXMark,
} from "react-icons/hi2";
import { z } from "zod";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { usePopup } from "~/providers/popup";
import { useWorkspace } from "~/providers/workspace";
import defaultTheme from "~/themes/default.json";
import { api } from "~/utils/api";

const COLOR_VARS = [
  { key: "primary",    label: t`Primary`,    default: defaultTheme.colors.primary },
  { key: "secondary",  label: t`Secondary`,  default: defaultTheme.colors.secondary },
  { key: "background", label: t`Background`, default: defaultTheme.colors.background },
  { key: "surface",    label: t`Surface`,    default: defaultTheme.colors.surface },
  { key: "text",       label: t`Text`,       default: defaultTheme.colors.text },
  { key: "textMuted",  label: t`Text Muted`, default: defaultTheme.colors.textMuted },
  { key: "border",     label: t`Border`,     default: defaultTheme.colors.border },
] as const;

const FONT_VARS = [
  { key: "body",      label: t`Body Font`,       default: defaultTheme.fonts.body },
  { key: "heading",   label: t`Heading Font`,    default: defaultTheme.fonts.heading },
  { key: "monospace", label: t`Monospace Font`,  default: defaultTheme.fonts.monospace },
] as const;

const SPACING_VARS = [
  { key: "xs", label: t`XS`, default: defaultTheme.spacing.xs },
  { key: "sm", label: t`SM`, default: defaultTheme.spacing.sm },
  { key: "md", label: t`MD`, default: defaultTheme.spacing.md },
  { key: "lg", label: t`LG`, default: defaultTheme.spacing.lg },
  { key: "xl", label: t`XL`, default: defaultTheme.spacing.xl },
] as const;

const themeFormSchema = z.object({
  name: z.string().min(1, { message: t`Name is required` }),
  // colors
  colorPrimary:    z.string().optional(),
  colorSecondary:  z.string().optional(),
  colorBackground: z.string().optional(),
  colorSurface:    z.string().optional(),
  colorText:       z.string().optional(),
  colorTextMuted:  z.string().optional(),
  colorBorder:     z.string().optional(),
  // fonts
  fontBody:       z.string().optional(),
  fontHeading:    z.string().optional(),
  fontMonospace:  z.string().optional(),
  // spacing
  spacingXs: z.string().optional(),
  spacingSm: z.string().optional(),
  spacingMd: z.string().optional(),
  spacingLg: z.string().optional(),
  spacingXl: z.string().optional(),
  // custom css
  css: z.string().optional(),
});
type ThemeFormValues = z.infer<typeof themeFormSchema>;

type ThemeVariables = {
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  spacing?: Record<string, string>;
};

function variablesToFormValues(variables: unknown): Partial<ThemeFormValues> {
  const v = (variables ?? {}) as ThemeVariables;
  return {
    colorPrimary:    v.colors?.primary,
    colorSecondary:  v.colors?.secondary,
    colorBackground: v.colors?.background,
    colorSurface:    v.colors?.surface,
    colorText:       v.colors?.text,
    colorTextMuted:  v.colors?.textMuted,
    colorBorder:     v.colors?.border,
    fontBody:        v.fonts?.body,
    fontHeading:     v.fonts?.heading,
    fontMonospace:   v.fonts?.monospace,
    spacingXs:       v.spacing?.xs,
    spacingSm:       v.spacing?.sm,
    spacingMd:       v.spacing?.md,
    spacingLg:       v.spacing?.lg,
    spacingXl:       v.spacing?.xl,
  };
}

function formValuesToVariables(values: ThemeFormValues): ThemeVariables {
  return {
    colors: {
      primary:    values.colorPrimary    ?? "",
      secondary:  values.colorSecondary  ?? "",
      background: values.colorBackground ?? "",
      surface:    values.colorSurface    ?? "",
      text:       values.colorText       ?? "",
      textMuted:  values.colorTextMuted  ?? "",
      border:     values.colorBorder     ?? "",
    },
    fonts: {
      body:       values.fontBody      ?? "",
      heading:    values.fontHeading   ?? "",
      monospace:  values.fontMonospace ?? "",
    },
    spacing: {
      xs: values.spacingXs ?? "",
      sm: values.spacingSm ?? "",
      md: values.spacingMd ?? "",
      lg: values.spacingLg ?? "",
      xl: values.spacingXl ?? "",
    },
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
      {children}
    </h3>
  );
}

function ThemeForm({
  defaultValues,
  onSubmit,
  onCancel,
  isPending,
}: {
  defaultValues: ThemeFormValues;
  onSubmit: (values: ThemeFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ThemeFormValues>({
    resolver: zodResolver(themeFormSchema),
    defaultValues,
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-lg border border-light-400 bg-white p-5 dark:border-dark-400 dark:bg-dark-100"
    >
      <div>
        <label htmlFor="theme-name" className="mb-1 block text-sm font-medium text-light-1100 dark:text-dark-1100">
          {t`Name`}
        </label>
        <Input
          id="theme-name"
          placeholder={t`My Theme`}
          {...register("name")}
          errorMessage={errors.name?.message}
        />
      </div>

      {/* Colors */}
      <div>
        <SectionHeading>{t`Colors`}</SectionHeading>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_VARS.map((item) => {
            const { key, label } = item;
            const fieldKey = `color${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ThemeFormValues;
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const textValue = useWatch({ control, name: fieldKey }) as string | undefined;
            return (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-light-1000 dark:text-dark-1000">
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textValue || item.default}
                    onChange={(e) => setValue(fieldKey, e.target.value, { shouldDirty: true })}
                    className="h-8 w-8 cursor-pointer rounded border border-light-300 p-0.5 dark:border-dark-300"
                  />
                  <input
                    type="text"
                    {...register(fieldKey)}
                    className="w-full rounded-md border border-light-300 px-2 py-1.5 text-xs font-mono dark:border-dark-300 dark:bg-dark-200"
                    placeholder={item.default}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <SectionHeading>{t`Fonts`}</SectionHeading>
        <div className="flex flex-col gap-3">
          {FONT_VARS.map((item) => {
            const { key, label } = item;
            const fieldKey = `font${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ThemeFormValues;
            return (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-light-1000 dark:text-dark-1000">
                  {label}
                </label>
                <input
                  type="text"
                  {...register(fieldKey)}
                  className="w-full rounded-md border border-light-300 px-2 py-1.5 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
                  placeholder={item.default}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <SectionHeading>{t`Spacing`}</SectionHeading>
        <div className="grid grid-cols-5 gap-3">
          {SPACING_VARS.map((item) => {
            const { key, label } = item;
            const fieldKey = `spacing${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ThemeFormValues;
            return (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-light-1000 dark:text-dark-1000">
                  {label}
                </label>
                <input
                  type="text"
                  {...register(fieldKey)}
                  className="w-full rounded-md border border-light-300 px-2 py-1.5 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
                  placeholder={item.default}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom CSS */}
      <div>
        <SectionHeading>{t`Custom CSS`}</SectionHeading>
        <textarea
          {...register("css")}
          rows={6}
          className="w-full rounded-md border border-light-300 p-2 text-sm font-mono dark:border-dark-300 dark:bg-dark-200"
          placeholder={`.board-header { background: #fff; }\n.card { border-radius: 8px; }`}
        />
        <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
          {t`CSS is injected globally when this theme is active.`}
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-light-300 pt-4 dark:border-dark-300">
        <Button variant="secondary" onClick={onCancel} type="button">
          {t`Cancel`}
        </Button>
        <Button variant="primary" type="submit" isLoading={isPending} disabled={isPending}>
          {t`Save theme`}
        </Button>
      </div>
    </form>
  );
}

export default function ThemesView() {
  const { workspace } = useWorkspace();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const themesQuery = api.theme.list.useQuery(
    { workspacePublicId: workspace.publicId },
    { enabled: !!workspace.publicId },
  );

  const createTheme = api.theme.create.useMutation({
    onSuccess: async () => {
      showPopup({ header: t`Theme created`, message: t`Your theme has been created.`, icon: "success" });
      setCreating(false);
      await utils.theme.list.invalidate();
    },
    onError: () => showPopup({ header: t`Error`, message: t`Failed to create theme.`, icon: "error" }),
  });

  const updateTheme = api.theme.update.useMutation({
    onSuccess: async () => {
      showPopup({ header: t`Theme updated`, message: t`Your theme has been saved.`, icon: "success" });
      setEditingId(null);
      await utils.theme.list.invalidate();
    },
    onError: () => showPopup({ header: t`Error`, message: t`Failed to update theme.`, icon: "error" }),
  });

  const deleteTheme = api.theme.delete.useMutation({
    onSuccess: async () => {
      showPopup({ header: t`Theme deleted`, message: t`The theme has been deleted.`, icon: "success" });
      setDeletingId(null);
      await utils.theme.list.invalidate();
    },
    onError: () => showPopup({ header: t`Error`, message: t`Failed to delete theme.`, icon: "error" }),
  });

  return (
    <>
      <Head>
        <title>{t`Themes - ${workspace.name ?? "Workspace"} - kan.bn`}</title>
      </Head>
      <div className="m-auto h-full max-w-[1100px] p-8 px-5 md:px-28 md:py-12">
        <div className="relative z-10 mb-8 flex w-full items-center justify-between">
          <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
            {t`Themes`}
          </h1>
          {!creating && (
            <Button
              variant="secondary"
              iconLeft={<HiOutlinePlusSmall className="h-4 w-4" />}
              onClick={() => {
                setEditingId(null);
                setCreating(true);
              }}
            >
              {t`New theme`}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {creating && (
            <ThemeForm
              defaultValues={{ name: "", css: "", ...variablesToFormValues({}) }}
              onSubmit={(values) =>
                createTheme.mutate({
                  workspacePublicId: workspace.publicId,
                  name: values.name,
                  css: values.css,
                  variables: formValuesToVariables(values),
                })
              }
              onCancel={() => setCreating(false)}
              isPending={createTheme.isPending}
            />
          )}

          {/* Built-in default theme (read-only) */}
          <div className="flex items-center justify-between rounded-lg border border-light-300 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <div>
              <h2 className="font-semibold text-light-1100 dark:text-dark-1100">
                {t`Default Theme`}
              </h2>
              <p className="mt-0.5 text-sm text-light-900 dark:text-dark-900">
                {t`Built-in · applied when no custom theme is selected`}
              </p>
            </div>
          </div>

          {/* Custom themes */}
          {themesQuery.isLoading && (
            <div className="text-sm text-light-900 dark:text-dark-900">{t`Loading…`}</div>
          )}
          {themesQuery.data?.map((theme) =>
            editingId === theme.id ? (
              <ThemeForm
                key={theme.id}
                defaultValues={{
                  name: theme.name,
                  css: typeof theme.css === "string" ? theme.css : "",
                  ...variablesToFormValues(theme.variables),
                }}
                onSubmit={(values) =>
                  updateTheme.mutate({
                    id: theme.id,
                    name: values.name,
                    css: values.css,
                    variables: formValuesToVariables(values),
                  })
                }
                onCancel={() => setEditingId(null)}
                isPending={updateTheme.isPending}
              />
            ) : (
              <div
                key={theme.id}
                className="flex items-center justify-between rounded-lg border border-light-300 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
              >
                <div className="min-w-0">
                  <h2 className="font-semibold text-light-1100 dark:text-dark-1100 truncate">
                    {theme.name}
                  </h2>
                  {theme.css && (
                    <p className="mt-0.5 text-sm text-light-900 dark:text-dark-900">
                      {t`Custom CSS`}
                    </p>
                  )}
                </div>

                {deletingId === theme.id ? (
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-sm text-light-900 dark:text-dark-900">
                      {t`Delete this theme?`}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={deleteTheme.isPending}
                      disabled={deleteTheme.isPending}
                      onClick={() => deleteTheme.mutate({ id: theme.id })}
                    >
                      {t`Delete`}
                    </Button>
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-light-200 dark:hover:bg-dark-300"
                      onClick={() => setDeletingId(null)}
                    >
                      <HiXMark size={16} className="text-light-900 dark:text-dark-900" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <button
                      type="button"
                      className="rounded p-1.5 hover:bg-light-200 dark:hover:bg-dark-300"
                      title={t`Edit theme`}
                      onClick={() => {
                        setCreating(false);
                        setDeletingId(null);
                        setEditingId(theme.id);
                      }}
                    >
                      <HiOutlinePencil size={16} className="text-light-900 dark:text-dark-900" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 hover:bg-light-200 dark:hover:bg-dark-300"
                      title={t`Delete theme`}
                      onClick={() => {
                        setEditingId(null);
                        setDeletingId(theme.id);
                      }}
                    >
                      <HiOutlineTrash size={16} className="text-light-900 dark:text-dark-900" />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}
