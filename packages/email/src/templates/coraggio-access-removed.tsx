import { Link } from "@react-email/link";
import * as React from "react";

import { colours, CoraggioEmailLayout } from "./coraggio-layout";

/** Security email: always sent, even to users who turned off notifications. */
export const CoraggioAccessRemovedTemplate = ({
  workspaceName,
  removerName,
  removerEmail,
}: {
  workspaceName: string;
  removerName: string;
  removerEmail: string;
}) => (
  <CoraggioEmailLayout
    preview={`You no longer have access to the ${workspaceName} pipeline`}
    eyebrow="Access removed"
    headline={`You no longer have access to the ${workspaceName} pipeline.`}
    finePrint={
      <>
        Think this is a mistake? Reach out to{" "}
        {removerEmail ? (
          <Link
            href={`mailto:${removerEmail}`}
            style={{ color: colours.muted, textDecoration: "underline" }}
          >
            {removerName}
          </Link>
        ) : (
          removerName
        )}
        .
      </>
    }
  />
);

export default CoraggioAccessRemovedTemplate;
