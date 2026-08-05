import { createLogger } from "@kan/logger";

const log = createLogger("subscriberClient");

export const subscriberClient =
  process.env.NEXT_PUBLIC_KAN_ENV === "cloud" &&
  process.env.SUBSCRIBER_API_URL &&
  process.env.SUBSCRIBER_API_KEY &&
  process.env.SUBSCRIBER_ENVIRONMENT_ID
    ? {
        apiUrl: process.env.SUBSCRIBER_API_URL,
        apiKey: process.env.SUBSCRIBER_API_KEY,
        environmentId: process.env.SUBSCRIBER_ENVIRONMENT_ID,
      }
    : null;

interface CreateSubscriberInput {
  publicId: string;
  email: string;
  externalId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export async function createSubscriber(input: CreateSubscriberInput) {
  if (!subscriberClient) return;

  try {
    const response = await fetch(
      `${subscriberClient.apiUrl}/environments/${subscriberClient.environmentId}/subscribers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": subscriberClient.apiKey,
        },
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      log.error(
        {
          status: response.status,
          body: await response.text().catch(() => undefined),
        },
        "Failed to create subscriber.dev subscriber",
      );
    }
  } catch (error) {
    log.error({ err: error }, "Error creating subscriber.dev subscriber");
  }
}

interface UpdateSubscriberPreferencesInput {
  email: boolean;
}

export async function updateSubscriberPreferences(
  subscriberId: string,
  input: UpdateSubscriberPreferencesInput,
) {
  if (!subscriberClient) return;

  try {
    const response = await fetch(
      `${subscriberClient.apiUrl}/environments/${subscriberClient.environmentId}/subscribers/${subscriberId}/preferences`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": subscriberClient.apiKey,
        },
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      log.error(
        {
          status: response.status,
          body: await response.text().catch(() => undefined),
        },
        "Failed to update subscriber preferences",
      );
    }
  } catch (error) {
    log.error({ err: error }, "Error updating subscriber.dev preferences");
  }
}
