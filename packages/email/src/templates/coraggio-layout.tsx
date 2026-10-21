import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";
import { env } from "next-runtime-env";
import * as React from "react";

// Colours from themes/coraggio.yaml and docs/designs/Email - *.png
export const colours = {
  background: "#1d1912",
  panel: "#29241e",
  code: "#3d3a36",
  gold: "#eecd5c",
  text: "#ffffff",
  muted: "#a8a29a",
  rule: "#5c5750",
};

// Altivo (the app font) is an Adobe font, so emails fall back to system fonts
const fontFamily =
  'Altivo, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const textStyle = {
  fontSize: "16px",
  lineHeight: "1.5",
  margin: "0 0 16px",
  color: colours.text,
};

export const finePrintStyle = {
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  color: colours.muted,
  textAlign: "center" as const,
};

/** "Manage notifications" link for the fine print of opt-out-able emails. */
export const ManageNotificationsLink = () => (
  <Link
    href={`${env("NEXT_PUBLIC_BASE_URL")}/settings/notifications`}
    target="_blank"
    style={{ color: colours.muted, textDecoration: "underline" }}
  >
    Manage notifications
  </Link>
);

/**
 * A contact summary like a board card: gold left border, name | parish, then
 * labelled rows (follow-up date, task).
 */
export const ContactBox = ({
  name,
  detail,
  rows = [],
}: {
  name: string;
  detail?: string;
  rows?: { label: string; value: string; highlight?: boolean }[];
}) => (
  <Section
    style={{
      backgroundColor: colours.panel,
      borderLeft: `6px solid ${colours.gold}`,
      borderRadius: "8px",
      padding: "18px 24px",
      margin: "0 0 16px",
    }}
  >
    <Text
      style={{
        ...textStyle,
        fontWeight: "bold",
        margin: rows.length ? "0 0 12px" : "0",
      }}
    >
      {name}
      {detail ? (
        <span style={{ color: colours.muted, fontWeight: "normal" }}>
          {"\u00a0\u00a0|\u00a0\u00a0"}
          {detail}
        </span>
      ) : null}
    </Text>
    {rows.map((row) => (
      <React.Fragment key={row.label}>
        <Text
          style={{
            ...textStyle,
            fontSize: "14px",
            fontWeight: "bold",
            margin: "0 0 2px 24px",
          }}
        >
          {row.label}
        </Text>
        <Text
          style={{
            ...textStyle,
            fontSize: "15px",
            margin: "0 0 10px 24px",
            ...(row.highlight
              ? { color: colours.gold, fontWeight: "bold" }
              : { color: colours.muted }),
          }}
        >
          {/* not white-space: pre-wrap, which would keep the rendered HTML's indentation */}
          {row.value.split("\n").map((line, index) => (
            <React.Fragment key={index}>
              {index > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </Text>
      </React.Fragment>
    ))}
  </Section>
);

/**
 * Shared shell for Coraggio emails (docs/designs/Email - *.png): logo, gold
 * eyebrow, headline, optional body and button, fine print, partner footer.
 */
export const CoraggioEmailLayout = ({
  preview,
  eyebrow,
  headline,
  buttonText,
  buttonUrl,
  finePrint,
  children,
}: {
  preview: string;
  eyebrow: string;
  headline: string;
  buttonText?: string;
  buttonUrl?: string;
  finePrint?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <Html>
    <Head>
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
    </Head>
    <Preview>{preview}</Preview>
    <Body
      style={{
        backgroundColor: colours.background,
        margin: "0",
        padding: "0",
        fontFamily,
      }}
    >
      <Container
        style={{
          backgroundColor: colours.background,
          maxWidth: "600px",
          margin: "0 auto",
          padding: "40px 28px 0",
        }}
      >
        <Text
          style={{
            fontSize: "44px",
            lineHeight: "1",
            fontWeight: "bold",
            letterSpacing: "-0.5px",
            color: colours.text,
            margin: "0 0 64px",
          }}
        >
          coragg.io
        </Text>
        <Text
          style={{
            fontSize: "14px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            color: colours.gold,
            margin: "0 0 12px",
          }}
        >
          {eyebrow}
        </Text>
        <Heading
          as="h1"
          style={{
            fontSize: "34px",
            lineHeight: "1.2",
            fontWeight: "bold",
            color: colours.text,
            margin: "0 0 32px",
          }}
        >
          {headline}
        </Heading>
        {children}
        {buttonText && buttonUrl ? (
          <Button
            target="_blank"
            href={buttonUrl}
            style={{
              marginTop: "16px",
              borderRadius: "999px",
              backgroundColor: colours.gold,
              padding: "16px 40px",
              fontSize: "14px",
              fontWeight: "bold",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: colours.background,
            }}
          >
            {buttonText}
          </Button>
        ) : null}
        <Section style={{ marginTop: "64px" }}>
          {finePrint ? <Text style={finePrintStyle}>{finePrint}</Text> : null}
        </Section>
      </Container>
      <Hr
        style={{
          borderColor: colours.rule,
          borderWidth: "1px 0 0",
          margin: "16px 0 0",
          width: "100%",
        }}
      />
      <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Text
          style={{
            ...finePrintStyle,
            fontSize: "12px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: colours.text,
            padding: "32px 0 40px",
            margin: "0",
          }}
        >
          National Society for Priestly Vocations
          <span style={{ color: colours.gold, fontSize: "20px" }}>
            {"\u00a0\u00a0+\u00a0\u00a0"}
          </span>
          5 Stones
        </Text>
      </Container>
    </Body>
  </Html>
);

/** First word of a contact's name, for buttons like "Open Mike's card". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Mike's" / "James'" */
export const possessive = (name: string) =>
  name.endsWith("s") ? `${name}'` : `${name}'s`;
