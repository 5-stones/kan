import { Text } from "@react-email/text";
import * as React from "react";

import { CoraggioEmailLayout, textStyle } from "./coraggio-layout";

export const CoraggioCardAssignedTemplate = ({
  assignerName,
  contactName,
  boardName,
  cardUrl,
}: {
  assignerName: string;
  contactName: string;
  boardName: string;
  cardUrl: string;
}) => (
  <CoraggioEmailLayout
    preview={`${assignerName} assigned you to ${contactName}`}
    heading="You've been assigned a contact"
    buttonText="Open contact"
    buttonUrl={cardUrl}
  >
    <Text style={textStyle}>
      <strong>{assignerName}</strong> assigned you to{" "}
      <strong>{contactName}</strong> on <strong>{boardName}</strong>.
    </Text>
  </CoraggioEmailLayout>
);

export default CoraggioCardAssignedTemplate;
