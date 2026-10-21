import * as React from "react";

import {
  ContactBox,
  CoraggioEmailLayout,
  firstName,
  ManageNotificationsLink,
  possessive,
} from "./coraggio-layout";

/** Sent once when a contact's follow-up date has passed without being moved. */
export const CoraggioFollowUpOverdueTemplate = ({
  contactName,
  parish,
  task,
  followUpDate,
  daysOverdue,
  cardUrl,
}: {
  contactName: string;
  parish: string;
  task: string;
  followUpDate: string;
  daysOverdue: number;
  cardUrl: string;
}) => {
  const due =
    daysOverdue === 1 ? "yesterday" : `${daysOverdue} days ago`;

  return (
    <CoraggioEmailLayout
      preview={task || `Follow up with ${contactName}`}
      eyebrow="Overdue"
      headline={`${possessive(contactName)} follow-up was due ${due}.`}
      buttonText={`Open ${possessive(firstName(contactName))} card`}
      buttonUrl={cardUrl}
      finePrint={<ManageNotificationsLink />}
    >
      <ContactBox
        name={contactName}
        detail={parish}
        rows={[
          { label: "follow-up date", value: followUpDate, highlight: true },
          ...(task ? [{ label: "task", value: task }] : []),
        ]}
      />
    </CoraggioEmailLayout>
  );
};

export default CoraggioFollowUpOverdueTemplate;
