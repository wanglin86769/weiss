import { Box } from "@mui/material";

import { useCallback, useEffect, useRef } from "react";
import {
  getDeployedRepoFile,
  getStagingRepoFile,
  type RepoTreeInfo,
} from "@src/services/APIClient";
import { useEditorContext } from "@src/context/useEditorContext";
import ProjectSection from "./ProjectSection";

export interface SelectedFileInfo {
  repo_id: string;
  path: string;
}
export interface RepoTreeProps {
  repoTreeList: RepoTreeInfo[];
}

export default function ProjectNavigator({ repoTreeList }: RepoTreeProps) {
  const { isDeveloper, loadWidgets } = useEditorContext();
  const restoredRef = useRef(false);

  const loadRepoFile = useCallback(
    async (repo_id: string, path: string, opts: { persist?: boolean } = { persist: true }) => {
      const res = isDeveloper
        ? await getStagingRepoFile({ path: { repo_id }, query: { path } })
        : await getDeployedRepoFile({ path: { repo_id }, query: { path } });

      loadWidgets(res.data.content);

      if (opts.persist) {
        localStorage.setItem("lastLoadedFile", JSON.stringify({ repo_id, path }));
      }
    },
    [isDeveloper, loadWidgets]
  );

  useEffect(() => {
    if (restoredRef.current) return;
    if (!repoTreeList.length) return;

    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) {
      restoredRef.current = true;
      return;
    }

    const { repo_id, path } = JSON.parse(raw) as SelectedFileInfo;
    const repo = repoTreeList.find((r) => r.id === repo_id);
    if (!repo) {
      restoredRef.current = true;
      return;
    }

    loadRepoFile(repo_id, path, { persist: false })
      .catch(() => undefined)
      .finally(() => {
        restoredRef.current = true;
      });
  }, [repoTreeList, loadRepoFile]);

  return (
    <Box sx={{ height: "100%", overflowY: "auto" }}>
      {repoTreeList.map((repo) => (
        <ProjectSection key={repo.id} repo={repo} onFileSelect={loadRepoFile} />
      ))}
    </Box>
  );
}
