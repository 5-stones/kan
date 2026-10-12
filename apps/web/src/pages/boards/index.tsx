import type { NextPageWithLayout } from "../_app";
import { getDashboardLayout } from "~/components/Dashboard";
import Popup from "~/components/Popup";
import BoardsView from "~/views/boards";
import { useRedirectToMainBoard } from "~/views/coraggio/useRedirectToMainBoard"; // coraggio

const BoardsPage: NextPageWithLayout = () => {
  // coraggio: forward to the diocese's pipeline board
  const isRedirecting = useRedirectToMainBoard();
  if (isRedirecting) return null;

  return (
    <>
      <BoardsView />
      <Popup />
    </>
  );
};

BoardsPage.getLayout = (page) => getDashboardLayout(page);

export default BoardsPage;
