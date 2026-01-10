import { Box } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDeployedRepoFile,
  getStagingRepoFile,
  updateStagingRepoFile,
} from "@src/services/APIClient";
import { useEditorContext } from "@src/context/useEditorContext";
import ProjectSection from "./ProjectSection";
import { notifyUser } from "@src/services/Notifications/Notification";
export interface SelectedFileInfo {
  repo_id: string;
  path: string;
}

export default function ProjectsTab() {
  const {
    isDeveloper,
    loadWidgets,
    reposTreeInfo,
    updateReposTreeInfo,
    inEditMode,
    editorWidgets,
    formatWdgToExport,
  } = useEditorContext();
  const restoredRef = useRef(false);
  const [initialSelection, setInitialSelection] = useState<SelectedFileInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFileInfo | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void updateReposTreeInfo();
  }, [updateReposTreeInfo]);

  // throttle file update to backend
  useEffect(() => {
    if (!isDeveloper || !inEditMode) return;
    if (!selectedFile?.repo_id || !selectedFile.path) return;

    const exportable = editorWidgets.map(formatWdgToExport);
    const serialized = JSON.stringify(exportable);
    // Skip if content didn't change
    if (lastSavedRef.current === serialized) return;

    // debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const updateFileContent = async () => {
      try {
        await updateStagingRepoFile({
          path: { repo_id: selectedFile.repo_id },
          query: { path: selectedFile.path },
          body: { content: serialized },
        });

        lastSavedRef.current = serialized;
      } catch {
        notifyUser("Failed to save file", "error");
      }
    };

    saveTimeoutRef.current = window.setTimeout(() => void updateFileContent(), 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorWidgets, selectedFile, isDeveloper, inEditMode]);

  const loadRepoFile = useCallback(
    async (repo_id: string, path: string, opts: { persist?: boolean } = { persist: true }) => {
      const res = isDeveloper
        ? await getStagingRepoFile({ path: { repo_id }, query: { path } })
        : await getDeployedRepoFile({ path: { repo_id }, query: { path } });

      loadWidgets(res.data.content);
      setSelectedFile({ repo_id, path });

      if (opts.persist) {
        localStorage.setItem("lastLoadedFile", JSON.stringify({ repo_id, path }));
      }
    },
    [isDeveloper, loadWidgets]
  );

  // On first render, restore last loaded file
  useEffect(() => {
    if (restoredRef.current || !reposTreeInfo?.length) return;

    const raw = localStorage.getItem("lastLoadedFile");
    if (!raw) {
      restoredRef.current = true;
      return;
    }

    const parsed = JSON.parse(raw) as SelectedFileInfo;
    const repo = reposTreeInfo.find((r) => r.id === parsed.repo_id);
    if (!repo) {
      restoredRef.current = true;
      return;
    }

    setInitialSelection(parsed);
    // trigger file load once
    void loadRepoFile(parsed.repo_id, parsed.path, { persist: false });
    restoredRef.current = true;
  }, [reposTreeInfo, loadRepoFile]);

  return (
    <Box sx={{ height: "100%", overflowY: "auto" }}>
      {reposTreeInfo?.length ? (
        reposTreeInfo.map((repo) => (
          <ProjectSection
            key={repo.id}
            repo={repo}
            onFileSelect={loadRepoFile}
            defaultSelectedPath={
              initialSelection?.repo_id === repo.id ? initialSelection.path : undefined
            }
          />
        ))
      ) : (
        <div style={{ padding: 16 }}>No repositories available.</div>
      )}
    </Box>
  );
}
