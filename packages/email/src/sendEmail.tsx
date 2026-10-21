import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { createLogger } from "@kan/logger";

const log = createLogger("email");

// coraggio: join-workspace, magic-link and reset-password are replaced below
import MentionTemplate from "./templates/mention";
// coraggio: notification templates
import CoraggioCardAssignedTemplate from "./templates/coraggio-card-assigned";
import CoraggioFollowUpReminderTemplate from "./templates/coraggio-follow-up-reminder";
import CoraggioFollowUpOverdueTemplate from "./templates/coraggio-follow-up-overdue";
import CoraggioAccessRemovedTemplate from "./templates/coraggio-access-removed";
import CoraggioInviteTemplate from "./templates/coraggio-invite";
import {
  CoraggioMagicLinkTemplate,
  CoraggioResetPasswordTemplate,
} from "./templates/coraggio-sign-in";

type Templates =
  | "MAGIC_LINK"
  | "JOIN_WORKSPACE"
  | "RESET_PASSWORD"
  | "MENTION"
  | "CORAGGIO_CARD_ASSIGNED" // coraggio
  | "CORAGGIO_FOLLOW_UP_REMINDER" // coraggio
  | "CORAGGIO_FOLLOW_UP_OVERDUE" // coraggio
  | "CORAGGIO_ACCESS_REMOVED"; // coraggio

const emailTemplates: Record<Templates, React.ComponentType<any>> = {
  // coraggio: sign-in, invite and reset emails use the Coraggio layout
  MAGIC_LINK: CoraggioMagicLinkTemplate,
  JOIN_WORKSPACE: CoraggioInviteTemplate,
  RESET_PASSWORD: CoraggioResetPasswordTemplate,
  MENTION: MentionTemplate,
  CORAGGIO_CARD_ASSIGNED: CoraggioCardAssignedTemplate, // coraggio
  CORAGGIO_FOLLOW_UP_REMINDER: CoraggioFollowUpReminderTemplate, // coraggio
  CORAGGIO_FOLLOW_UP_OVERDUE: CoraggioFollowUpOverdueTemplate, // coraggio
  CORAGGIO_ACCESS_REMOVED: CoraggioAccessRemovedTemplate, // coraggio
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure:
    process.env.SMTP_SECURE === undefined
      ? true
      : process.env.SMTP_SECURE?.toLowerCase() === "true",
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized:
      process.env.SMTP_REJECT_UNAUTHORIZED === undefined
        ? true
        : process.env.SMTP_REJECT_UNAUTHORIZED?.toLowerCase() === "true",
  },
  ...(process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }),
});

export const sendEmail = async (
  to: string,
  subject: string,
  template: Templates,
  data: Record<string, unknown>, // coraggio: structured data (digest contact list)
) => {
  log.info({ to, subject, template }, "Sending email");
  try {
    const EmailTemplate = emailTemplates[template];

    const html = await render(<EmailTemplate {...data} />, { pretty: true });

    const options = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const response = await transporter.sendMail(options);

    if (!response.accepted.length) {
      throw new Error(`Failed to send email: ${response.response}`);
    }

    log.info({ to, subject, template, messageId: response.messageId }, "Email sent");
    return response;
  } catch (error) {
    log.error({ err: error, to, from: process.env.EMAIL_FROM, subject, template }, "Email sending failed");
    throw error;
  }
};
