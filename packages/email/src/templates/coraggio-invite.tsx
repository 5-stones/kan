import * as React from "react";

import { CoraggioEmailLayout } from "./coraggio-layout";

/** Replaces upstream JOIN_WORKSPACE (same props). */
export const CoraggioInviteTemplate = ({
  magicLoginUrl,
  inviterName,
  workspaceName,
}: {
  magicLoginUrl?: string;
  inviterName?: string;
  workspaceName?: string;
}) => {
  const pipeline = workspaceName
    ? `the ${workspaceName} discerners pipeline`
    : "a discerners pipeline";

  return (
    <CoraggioEmailLayout
      preview={`Join ${pipeline} on coragg.io`}
      eyebrow="Welcome"
      headline={
        inviterName
          ? `${inviterName} invited you to join ${pipeline}.`
          : `You've been invited to join ${pipeline}.`
      }
      buttonText="Join coragg.io"
      buttonUrl={magicLoginUrl}
      finePrint="Not expecting this? You can ignore this email."
    />
  );
};

export default CoraggioInviteTemplate;
