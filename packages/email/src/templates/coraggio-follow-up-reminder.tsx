import { Text } from "@react-email/text";
import * as React from "react";

import { CoraggioEmailLayout, textStyle } from "./coraggio-layout";

export const CoraggioFollowUpReminderTemplate = ({
  contactName,
  task,
  followUpDate,
  boardName,
  cardUrl,
}: {
  contactName: string;
  task: string;
  followUpDate: string;
  boardName: string;
  cardUrl: string;
}) => (
  <CoraggioEmailLayout
    preview={task ? `${contactName}: ${task}` : `Follow up with ${contactName}`}
    heading={`Follow up with ${contactName}`}
    buttonText="Open contact"
    buttonUrl={cardUrl}
  >
    <Text style={textStyle}>
      Today ({followUpDate}) is your follow-up date for{" "}
      <strong>{contactName}</strong> on <strong>{boardName}</strong>.
    </Text>
    {task ? (
      <Text
        style={{
          ...textStyle,
          padding: "0.75rem 1rem",
          borderLeft: "4px solid #f4c542",
          backgroundColor: "#faf7ef",
          whiteSpace: "pre-wrap",
        }}
      >
        {task}
      </Text>
    ) : null}
  </CoraggioEmailLayout>
);

export default CoraggioFollowUpReminderTemplate;
