import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { themes } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const findManyByWorkspace = async (db: dbClient, workspaceId: string) => {
  return db
    .select()
    .from(themes)
    .where(eq(themes.workspaceId, workspaceId));
};

export const findById = async (db: dbClient, id: string) => {
  const [result] = await db
    .select()
    .from(themes)
    .where(eq(themes.id, id));
  
  return result;
};

export const create = async (
  db: dbClient,
  themeInput: {
    workspaceId: string;
    name: string;
    css?: string;
    variables?: any;
  }
) => {
  const [result] = await db
    .insert(themes)
    .values({
      id: generateUID(),
      workspaceId: themeInput.workspaceId,
      name: themeInput.name,
      css: themeInput.css ?? null,
      variables: themeInput.variables ?? null,
    })
    .returning();

  return result;
};

export const update = async (
  db: dbClient,
  themeId: string,
  themeInput: {
    name?: string;
    css?: string;
    variables?: any;
  }
) => {
  const [result] = await db
    .update(themes)
    .set({
      ...themeInput,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, themeId))
    .returning();

  return result;
};

export const deleteTheme = async (db: dbClient, themeId: string) => {
  const [result] = await db
    .delete(themes)
    .where(eq(themes.id, themeId))
    .returning();
    
  return result;
};

export { deleteTheme as delete };
