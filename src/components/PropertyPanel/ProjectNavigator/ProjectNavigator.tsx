import { Box } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [initialSelection, setInitialSelection] = useState<SelectedFileInfo | null>(null);

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

  // On first render, restore last loaded file
  useEffect(() => {
    if (restoredRef.current || !repoTreeList.length) return;

    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) {
      restoredRef.current = true;
      return;
    }

    const parsed = JSON.parse(raw) as SelectedFileInfo;
    const repo = repoTreeList.find((r) => r.id === parsed.repo_id);
    if (!repo) {
      restoredRef.current = true;
      return;
    }

    setInitialSelection(parsed);
    // trigger file load once
    void loadRepoFile(parsed.repo_id, parsed.path, { persist: false });
    restoredRef.current = true;
  }, [repoTreeList, loadRepoFile]);

  return (
    <Box sx={{ height: "100%", overflowY: "auto" }}>
      {repoTreeList.map((repo) => (
        <ProjectSection
          key={repo.id}
          repo={repo}
          onFileSelect={loadRepoFile}
          defaultSelectedPath={
            initialSelection?.repo_id === repo.id ? initialSelection.path : undefined
          }
        />
      ))}
    </Box>
  );
}
