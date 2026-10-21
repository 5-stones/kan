import * as React from "react";

import {
  ContactBox,
  CoraggioEmailLayout,
  firstName,
  ManageNotificationsLink,
  possessive,
} from "./coraggio-layout";

export interface FollowUpContact {
  name: string;
  parish: string;
  task: string;
  followUpDate: string;
  cardUrl: string;
}

/** "A, B, and C" for up to 3 names, otherwise "A, B, and 4 others". */
export function formatNameList(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
}

/**
 * The day's follow-ups for one VD: a single-contact email, or a digest when
 * two or more contacts are due.
 */
export const CoraggioFollowUpReminderTemplate = ({
  recipientName,
  contacts,
  listUrl,
}: {
  recipientName: string;
  contacts: FollowUpContact[];
  listUrl: string;
}) => {
  const greeting = recipientName ? `${recipientName}, ` : "";

  if (contacts.length === 1) {
    const contact = contacts[0]!;
    return (
      <CoraggioEmailLayout
        preview={contact.task || `Follow up with ${contact.name} today`}
        eyebrow="Follow-up due"
        headline={`${greeting}${greeting ? "it's" : "It's"} time to reach out to ${contact.name}.`}
        buttonText={`Open ${possessive(firstName(contact.name))} card`}
        buttonUrl={contact.cardUrl}
        finePrint={<ManageNotificationsLink />}
      >
        <ContactBox
          name={contact.name}
          detail={contact.parish}
          rows={[
            { label: "follow-up date", value: contact.followUpDate, highlight: true },
            ...(contact.task ? [{ label: "task", value: contact.task }] : []),
          ]}
        />
      </CoraggioEmailLayout>
    );
  }

  const names = formatNameList(contacts.map((contact) => contact.name));
  return (
    <CoraggioEmailLayout
      preview={`${contacts.length} follow-ups today: ${names}`}
      eyebrow="Today's follow-ups"
      headline={`${greeting}${greeting ? "you" : "You"} have ${contacts.length} men to reach out to today: ${names}.`}
      buttonText="See today's list"
      buttonUrl={listUrl}
      finePrint={<ManageNotificationsLink />}
    >
      {contacts.map((contact) => (
        <ContactBox
          key={contact.cardUrl}
          name={contact.name}
          detail={contact.parish}
          rows={contact.task ? [{ label: "task", value: contact.task }] : []}
        />
      ))}
    </CoraggioEmailLayout>
  );
};

export default CoraggioFollowUpReminderTemplate;
