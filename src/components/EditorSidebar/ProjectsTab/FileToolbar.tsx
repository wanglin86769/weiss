import { Box, IconButton, Tooltip } from "@mui/material";
import type { SelectedFileInfo } from "./ProjectsTab";
import { CreateNewFolderOutlined, DeleteOutlined, NoteAddOutlined } from "@mui/icons-material";
import {
  createStagingRepoPath,
  deleteStagingRepoPath,
  type RepoTreeInfo,
} from "@src/services/APIClient";
import { notifyUser } from "@src/services/Notifications/Notification";

interface FileToolbarProps {
  selectedFile: SelectedFileInfo | null;
  onRepoUpdate: (update: RepoTreeInfo) => void;
}

export default function FileToolbar({ selectedFile, onRepoUpdate }: FileToolbarProps) {
  const iconSx = { fontSize: 18 };

  async function createPath(repo_id: string, path: string, type: "file" | "directory") {
    try {
      const updt = await createStagingRepoPath({
        path: { repo_id },
        body: { path, type },
      }).then((r) => r.data);
      onRepoUpdate(updt);
    } catch (err) {
      notifyUser(`Failed to create path: ${err as string}`, "error");
    }
  }

  async function deletePath(repo_id: string, path: string) {
    try {
      const updt = await deleteStagingRepoPath({
        path: { repo_id },
        query: { path },
      }).then((r) => r.data);
      onRepoUpdate(updt);
    } catch {
      notifyUser("Failed to delete path", "error");
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* New File */}
      <Tooltip title="Create new file">
        <IconButton
          onClick={() => {
            if (!selectedFile) return;
            const name = prompt("Enter new file name (without extension):");
            if (!name) return;
            void createPath(selectedFile.repo_id, `${selectedFile.path}/${name}`, "file");
          }}
        >
          <NoteAddOutlined sx={iconSx} />
        </IconButton>
      </Tooltip>

      {/* New Folder */}
      <Tooltip title="Create new folder">
        <IconButton
          onClick={() => {
            if (!selectedFile) return;
            const name = prompt("Enter new folder name:");
            if (!name) return;
            void createPath(selectedFile.repo_id, `${selectedFile.path}/${name}`, "directory");
          }}
        >
          <CreateNewFolderOutlined sx={iconSx} />
        </IconButton>
      </Tooltip>

      {/* Delete selected path */}
      <Tooltip title="Delete selected path">
        <IconButton
          onClick={() => {
            if (!selectedFile) return;
            const confirmDelete = confirm(`Delete "${selectedFile.path}"?`);
            if (!confirmDelete) return;
            void deletePath(selectedFile.repo_id, selectedFile.path);
          }}
        >
          <DeleteOutlined sx={iconSx} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
