import Head from "next/head";

export const PageHead = ({ title }: { title: string }) => {
  return (
    <Head>
      <title>{title}</title>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"
      />
      {/* coraggio: no web app manifest; upstream's makes Chrome offer to install "Kan.bn | The open source alternative to Trello" */}
    </Head>
  );
};
