import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDeployedRepoFile,
  getStagingRepoFile,
  updateStagingRepoFile,
  type RepoTreeInfo,
} from "@src/services/APIClient";
import { useEditorContext } from "@src/context/useEditorContext";
import ProjectSection from "./ProjectSection";
import { notifyUser } from "@src/services/Notifications/Notification";
import type { ExportedWidget } from "@src/types/widgets";
import { Box } from "@mui/material";
export interface SelectedPathInfo {
  repo_id: string;
  path: string;
}

export default function ProjectsTab() {
  const {
    isDeveloper,
    loadWidgets,
    reposTreeInfo,
    setReposTreeInfo,
    updateReposTreeInfo,
    inEditMode,
    editorWidgets,
    formatWdgToExport,
  } = useEditorContext();
  const restoredRef = useRef(false);
  const [initialSelection, setInitialSelection] = useState<SelectedPathInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedPathInfo | null>(null);
  const lastSavedRef = useRef<ExportedWidget[] | null>(null);
  const hasFileChanged = useRef(true);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void updateReposTreeInfo();
  }, [updateReposTreeInfo]);

  const refreshRepoTree = (updt: RepoTreeInfo) => {
    setReposTreeInfo((prev) => (prev ? prev.map((r) => (updt.id === r.id ? updt : r)) : prev));
  };
  // throttle file update to backend
  useEffect(() => {
    if (!isDeveloper || !inEditMode) return;
    if (!selectedFile?.repo_id || !selectedFile.path) return;
    // Skip the first render after selecting a new file
    if (hasFileChanged.current) {
      hasFileChanged.current = false;
      return;
    }
    const exportable = editorWidgets.map(formatWdgToExport);
    // Skip if content didn't change
    if (lastSavedRef.current === exportable) return;
    const serialized = JSON.stringify(exportable, null, 2);

    // debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const updateFileContent = async () => {
      try {
        const updtd = await updateStagingRepoFile({
          path: { repo_id: selectedFile.repo_id },
          query: { path: selectedFile.path },
          body: { content: serialized },
        }).then((r) => r.data);

        setReposTreeInfo((prev) => {
          if (!prev) return prev;
          return prev.map((r) => (r.id === updtd.id ? updtd : r));
        });
        lastSavedRef.current = exportable;
      } catch (err) {
        notifyUser(`Failed to save file: ${err as string}`, "error");
      }
    };

    saveTimeoutRef.current = window.setTimeout(() => void updateFileContent(), 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorWidgets, selectedFile, isDeveloper, inEditMode, formatWdgToExport, setReposTreeInfo]);

  const loadRepoFile = useCallback(
    async (repo_id: string, path: string, opts: { persist?: boolean } = { persist: true }) => {
      const res = isDeveloper
        ? await getStagingRepoFile({ path: { repo_id }, query: { path } })
        : await getDeployedRepoFile({ path: { repo_id }, query: { path } });

      loadWidgets(res.data.content);
      setSelectedFile({ repo_id, path });
      hasFileChanged.current = true;

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

    const parsed = JSON.parse(raw) as SelectedPathInfo;
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
            onRepoUpdate={refreshRepoTree}
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
