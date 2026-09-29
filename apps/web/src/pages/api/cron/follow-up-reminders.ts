// Coraggio: daily follow-up reminder emails, triggered by a scheduler (k8s CronJob).
import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "next-runtime-env";

import { sendFollowUpReminders } from "@kan/api/coraggio/reminders";
import { withApiLogging } from "@kan/api/utils/apiLogging";
import { createDrizzleClient } from "@kan/db/client";

function isAuthorized(req: NextApiRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization ?? "";
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default withApiLogging(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }
    if (!isAuthorized(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Not createNextApiContext: its session lookup treats the bearer token as an API key
    const db = createDrizzleClient();
    const stats = await sendFollowUpReminders({
      db,
      baseUrl: env("NEXT_PUBLIC_BASE_URL") ?? "",
    });

    return res.status(200).json(stats);
  },
);
