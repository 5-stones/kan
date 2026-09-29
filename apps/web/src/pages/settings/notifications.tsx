// Coraggio: notification preferences tab
import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import { SettingsLayout } from "~/components/SettingsLayout";
import NotificationSettings from "~/views/coraggio/NotificationSettings";

const NotificationSettingsPage: NextPageWithLayout = () => {
  return (
    <SettingsLayout currentTab="notifications">
      <NotificationSettings />
      <Popup />
    </SettingsLayout>
  );
};

NotificationSettingsPage.getLayout = (page) => getDashboardLayout(page);

export default NotificationSettingsPage;
