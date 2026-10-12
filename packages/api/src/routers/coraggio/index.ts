// Coraggio fork-owned API. Registered as `coraggio` in root.ts.
import { createTRPCRouter } from "../../trpc";
import { coraggioAdminRouter } from "./admin";
import { coraggioBoardsRouter } from "./boards";
import { coraggioContactsRouter } from "./contacts";
import { coraggioSettingsRouter } from "./settings";

export const coraggioRouter = createTRPCRouter({
  admin: coraggioAdminRouter,
  boards: coraggioBoardsRouter,
  contacts: coraggioContactsRouter,
  settings: coraggioSettingsRouter,
});
