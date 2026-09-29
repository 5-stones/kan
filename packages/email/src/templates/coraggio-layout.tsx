import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { env } from "next-runtime-env";
import * as React from "react";

export const textStyle = {
  fontSize: "0.9375rem",
  lineHeight: "1.5",
  marginBottom: "1rem",
  color: "#232323",
};

/** Shared shell for Coraggio notification emails. */
export const CoraggioEmailLayout = ({
  preview,
  heading,
  buttonText,
  buttonUrl,
  children,
}: {
  preview: string;
  heading: string;
  buttonText: string;
  buttonUrl: string;
  children: React.ReactNode;
}) => {
  const baseUrl = env("NEXT_PUBLIC_BASE_URL");

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "white" }}>
        <Container
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
            margin: "auto",
            paddingLeft: "0.75rem",
            paddingRight: "0.75rem",
          }}
        >
          <Heading
            style={{
              marginTop: "2.5rem",
              marginBottom: "2rem",
              fontSize: "28px",
              fontWeight: "bold",
              color: "#1d1914",
            }}
          >
            coragg.io
          </Heading>
          <Heading
            style={{ fontSize: "22px", fontWeight: "bold", color: "#232323" }}
          >
            {heading}
          </Heading>
          {children}
          <Button
            target="_blank"
            href={buttonUrl}
            style={{
              marginTop: "0.5rem",
              marginBottom: "2rem",
              borderRadius: "0.375rem",
              backgroundColor: "#f4c542",
              paddingLeft: "1.5rem",
              paddingRight: "1.5rem",
              paddingTop: "1rem",
              paddingBottom: "1rem",
              fontSize: "0.875rem",
              fontWeight: "600",
              lineHeight: "1",
              color: "#1d1914",
            }}
          >
            {buttonText}
          </Button>
          <Hr
            style={{
              marginTop: "2.5rem",
              marginBottom: "2rem",
              borderWidth: "1px",
            }}
          />
          <Text style={{ color: "#7e7e7e", fontSize: "0.8125rem" }}>
            You can turn off these emails in your{" "}
            <Link
              href={`${baseUrl}/settings/notifications`}
              target="_blank"
              style={{ color: "#7e7e7e", textDecoration: "underline" }}
            >
              notification settings
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
};
