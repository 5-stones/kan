import * as React from "react";

import { CoraggioEmailLayout } from "./coraggio-layout";

/** Replaces upstream MAGIC_LINK (same props). */
export const CoraggioMagicLinkTemplate = ({
  magicLoginUrl,
}: {
  magicLoginUrl?: string;
}) => (
  <CoraggioEmailLayout
    preview="Your coragg.io sign-in link"
    eyebrow="Sign in"
    headline="Click below to sign in."
    buttonText="coragg.io"
    buttonUrl={magicLoginUrl}
    finePrint="Didn't request this? You can ignore this email."
  />
);

/** Replaces upstream RESET_PASSWORD (same props). */
export const CoraggioResetPasswordTemplate = ({
  resetPasswordUrl,
}: {
  resetPasswordUrl?: string;
  resetPasswordToken?: string;
}) => (
  <CoraggioEmailLayout
    preview="Reset your coragg.io password"
    eyebrow="Reset password"
    headline="Use this link to choose a new password."
    buttonText="Reset password"
    buttonUrl={resetPasswordUrl}
    finePrint="Didn't request this? You can ignore this email."
  />
);
