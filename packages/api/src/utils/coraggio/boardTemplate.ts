import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import yaml from "js-yaml";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import * as boardRepo from "@kan/db/repository/board.repo";
import {
  CORAGGIO_ARCHIVE_BOARD_SLUG,
  CORAGGIO_THEME_ID,
  parseCustomFieldsConfig,
} from "@kan/shared";
import { generateSlug, generateUID } from "@kan/shared/utils";

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
  /** second board for contacts who left the pipeline (seminarians, non-candidates) */
  archiveBoard: z
    .object({
      name: z.string().min(1),
      lists: z.array(z.string().min(1)).min(1),
    })
    .optional(),
});

/** Archive board when the template file doesn't define one. */
export const DEFAULT_ARCHIVE_BOARD = {
  name: "Archive",
  lists: ["Seminarians", "Non-candidates"],
};

export interface BuiltInBoardTemplate {
  name: string;
  lists: string[];
  labels: { name: string; colour: string | null }[];
  customFieldsConfig: string | null;
  archiveBoard: { name: string; lists: string[] } | null;
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
      archiveBoard: parsed.archiveBoard ?? null,
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

/**
 * A board (or template) built from the built-in template file, for board.create
 * when the "coragg.io" template is picked: statuses, coloured labels, custom
 * fields and the coragg.io theme, like an onboarded diocese's board.
 */
export async function createBoardFromBuiltInTemplate(
  db: dbClient,
  args: {
    workspaceId: number;
    createdBy: string;
    name: string;
    type: "regular" | "template";
  },
) {
  const template = loadBuiltInBoardTemplate();
  if (!template) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No built-in board template is configured (CORAGGIO_BOARD_TEMPLATE)",
    });
  }

  // same rules as board.create, and never the archive board's slug
  let slug = generateSlug(args.name);
  const isSlugUnique =
    slug !== CORAGGIO_ARCHIVE_BOARD_SLUG &&
    (await boardRepo.isSlugUnique(db, { slug, workspaceId: args.workspaceId }));
  if (!isSlugUnique || args.type === "template") slug = `${slug}-${generateUID()}`;

  return boardRepo.createFromSnapshot(db, {
    source: builtInTemplateSnapshot(template),
    workspaceId: args.workspaceId,
    createdBy: args.createdBy,
    slug,
    name: args.name,
    type: args.type,
    themeId: CORAGGIO_THEME_ID,
  });
}

/**
 * Snapshot for the archive board: its own statuses, with the labels and custom
 * fields of the main board's source so archived contacts keep their data.
 */
export function archiveBoardSnapshot(
  archive: { name: string; lists: string[] },
  source: {
    customFieldsConfig?: string | null;
    labels: { name: string; colourCode: string | null }[];
  },
) {
  return {
    name: archive.name,
    customFieldsConfig: source.customFieldsConfig ?? null,
    labels: source.labels.map((label) => ({
      publicId: generateUID(),
      name: label.name,
      colourCode: label.colourCode,
    })),
    lists: archive.lists.map((name, index) => ({ name, index, cards: [] })),
  };
}
