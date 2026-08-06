import { z } from "zod";

export const themeSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable().optional(),
  name: z.string(),
  css: z.string().nullable().optional(),
  imports: z.string().nullable().optional(),
  variables: z.any().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date().nullable().optional(),
});

export const createThemeSchema = z.object({
  workspacePublicId: z.string().min(12),
  name: z.string().min(1).max(255),
  css: z.string().optional(),
  imports: z.string().optional(),
  variables: z.any().optional(),
});

export const updateThemeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  css: z.string().optional(),
  imports: z.string().optional(),
  variables: z.any().optional(),
});
