import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import yaml from "js-yaml";
import { z } from "zod";

import { parseCustomFieldsConfig } from "@kan/shared";
import { generateUID } from "@kan/shared/utils";

const BoardTemplateFileSchema = z.object({
  name: z.string().min(1),
  lists: z.array(z.string().min(1)).min(1),
  labels: z
    .array(
      z.object({
        name: z.string().min(1),
        colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
    )
    .default([]),
  /** custom fields YAML file, relative to the template file */
  customFieldsFile: z.string().optional(),
});

export interface BuiltInBoardTemplate {
  name: string;
  lists: string[];
  labels: { name: string; colour: string | null }[];
  customFieldsConfig: string | null;
}

/**
 * Built-in board template for onboarding, from the YAML file at
 * CORAGGIO_BOARD_TEMPLATE (see templates/coraggio.yml in the coraggio repo). Returns null when unset.
 * Re-read on every call so edits take effect without a restart.
 */
export function loadBuiltInBoardTemplate(): BuiltInBoardTemplate | null {
  const file = process.env.CORAGGIO_BOARD_TEMPLATE;
  if (!file) return null;

  try {
    const parsed = BoardTemplateFileSchema.parse(
      yaml.load(fs.readFileSync(file, "utf8")),
    );

    let customFieldsConfig: string | null = null;
    if (parsed.customFieldsFile) {
      customFieldsConfig = fs.readFileSync(
        path.resolve(path.dirname(file), parsed.customFieldsFile),
        "utf8",
      );
      // fail loudly now rather than when a VD opens a contact
      parseCustomFieldsConfig(customFieldsConfig);
    }

    return {
      name: parsed.name,
      lists: parsed.lists,
      labels: parsed.labels.map((label) => ({
        name: label.name,
        colour: label.colour ?? null,
      })),
      customFieldsConfig,
    };
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Built-in board template (${file}) is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

/** The template as a board snapshot for boardRepo.createFromSnapshot. */
export function builtInTemplateSnapshot(template: BuiltInBoardTemplate) {
  return {
    name: template.name,
    customFieldsConfig: template.customFieldsConfig,
    labels: template.labels.map((label) => ({
      publicId: generateUID(),
      name: label.name,
      colourCode: label.colour,
    })),
    lists: template.lists.map((name, index) => ({ name, index, cards: [] })),
  };
}
