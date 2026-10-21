import * as React from "react";

import {
  ContactBox,
  CoraggioEmailLayout,
  firstName,
  ManageNotificationsLink,
  possessive,
} from "./coraggio-layout";

export const CoraggioCardAssignedTemplate = ({
  assignerName,
  contactName,
  parish,
  followUpDate,
  cardUrl,
}: {
  assignerName: string;
  contactName: string;
  parish: string;
  followUpDate: string;
  cardUrl: string;
}) => (
  <CoraggioEmailLayout
    preview={`${assignerName} assigned ${contactName} to you`}
    eyebrow="Assigned to you"
    headline={`${assignerName} handed ${possessive(contactName)} card to you.`}
    buttonText={`Open ${possessive(firstName(contactName))} card`}
    buttonUrl={cardUrl}
    finePrint={<ManageNotificationsLink />}
  >
    <ContactBox
      name={contactName}
      detail={parish}
      rows={
        followUpDate
          ? [{ label: "follow-up date", value: followUpDate, highlight: true }]
          : []
      }
    />
  </CoraggioEmailLayout>
);

export default CoraggioCardAssignedTemplate;
