// Coraggio: NSPV admin tools
import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import AdminView from "~/views/coraggio/admin/AdminView";

const AdminPage: NextPageWithLayout = () => {
  return (
    <>
      <AdminView />
      <Popup />
    </>
  );
};

AdminPage.getLayout = (page) => getDashboardLayout(page);

export default AdminPage;
