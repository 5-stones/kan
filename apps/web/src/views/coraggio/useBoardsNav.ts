import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

/** The diocese's main board (the pipeline) and its archive board, if any. */
export function useBoardsNav() {
  const { workspace } = useWorkspace();
  const { data, isPending } = api.coraggio.boards.nav.useQuery(
    { workspacePublicId: workspace.publicId },
    { enabled: workspace.publicId.length >= 12, staleTime: 60_000 },
  );

  const main = data?.main ?? null;
  const archive = data?.archive ?? null;

  return {
    /** true until the boards are known (also while the workspace is still loading) */
    isPending,
    main,
    archive,
    /** the "main dashboard": the pipeline board, or the boards list until it's known */
    mainBoardHref: main ? `/boards/${main.publicId}` : "/boards",
    archiveBoardHref: archive ? `/boards/${archive.publicId}` : null,
  };
}
