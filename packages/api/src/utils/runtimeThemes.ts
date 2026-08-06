import fs from "fs";
import path from "path";

import yaml from "js-yaml";

const THEME_FILE_EXTENSIONS = [".json", ".yaml", ".yml"];

/**
 * Loads theme files from the directory pointed to by `KAN_THEMES_DIR`, keyed
 * by filename (without extension). Lets self-hosters ship extra themes via a
 * bind-mounted folder instead of rebuilding the image or using the theme
 * editor UI. Re-read on every call so edits take effect without a restart.
 */
export const loadRuntimeThemes = (): Record<string, unknown> => {
  const dir = process.env.KAN_THEMES_DIR;
  if (!dir) return {};

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return {};
  }

  const themes: Record<string, unknown> = {};

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!THEME_FILE_EXTENSIONS.includes(ext)) continue;

    const key = path.basename(entry, ext);

    try {
      const raw = fs.readFileSync(path.join(dir, entry), "utf8");
      themes[key] = yaml.load(raw);
    } catch (e) {
      console.error(`[runtimeThemes] failed to load "${entry}":`, e);
    }
  }

  return themes;
};
