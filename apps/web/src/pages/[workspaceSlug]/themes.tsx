import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import ThemesView from "~/views/themes";

const ThemesPage: NextPageWithLayout = () => {
  return (
    <>
      <ThemesView />
      <Popup />
    </>
  );
};

ThemesPage.getLayout = (page) => getDashboardLayout(page);

export default ThemesPage;