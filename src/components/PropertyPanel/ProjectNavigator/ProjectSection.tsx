import {
  Box,
  Typography,
  Paper,
  Chip,
  Select,
  MenuItem,
  Divider,
  IconButton,
  Menu,
  Tooltip,
} from "@mui/material";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CommitIcon from "@mui/icons-material/Commit";
import SyncIcon from "@mui/icons-material/Sync";
import Collapse from "@mui/material/Collapse";

import { useState } from "react";
import {
  checkoutRepoRef,
  deployRepo,
  fetchRepo,
  type RepoTreeInfo,
  type TreeNode,
} from "@src/services/APIClient";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { useEditorContext } from "@src/context/useEditorContext";
import { notifyUser } from "@src/services/Notifications/Notification";

export interface ProjectSectionProps {
  repo: RepoTreeInfo;
  onFileSelect: (repo_id: string, path: string) => Promise<void>;
}

export default function ProjectSection({ repo, onFileSelect }: ProjectSectionProps) {
  const REF_MAX_DISPLAY_SIZE = 7;

  const { isDeveloper, fetchRepoTreeList } = useEditorContext();

  const [expanded, setExpanded] = useState(true);
  const selectedRef = repo.checked_out_ref;
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const menuOpen = Boolean(menuAnchor);
  const shortRef = (ref: string) => ref.substring(0, REF_MAX_DISPLAY_SIZE);

  const handleRefChange = async (ref: string) => {
    try {
      await checkoutRepoRef({
        path: { repo_id: repo.id },
        query: { ref },
      });
      await fetchRepoTreeList();
      notifyUser(`Success: HEAD at ${shortRef(ref)}`, "success");
    } catch (err) {
      notifyUser(`Failed to checkout: ${err as string}`, "error");
    }
  };

  const handleDeploy = async () => {
    if (!selectedRef) return;

    try {
      const res = await deployRepo({
        body: { deployment_version: selectedRef },
        path: { repo_id: repo.id },
      }).then((r) => r.data);

      if (res.repo_id !== repo.id || res.commit_hash !== selectedRef) {
        throw new Error("Invalid deployment response");
      }

      notifyUser(`Successfully deployed ${repo.alias}@${shortRef(selectedRef)}`, "success");
    } catch (err) {
      notifyUser(`Failed to deploy repo: ${err as string}`, "error");
    }

    setMenuAnchor(null);
  };

  const handleFileClick = (node: TreeNode) => {
    if (node.type !== "file") return;
    void onFileSelect(repo.id, node.path);
  };

  const handleSyncClick = async () => {
    try {
      await fetchRepo({ path: { repo_id: repo.id } });
      notifyUser(`Successfully updated ${repo.alias}`, "success");
    } catch (err) {
      notifyUser(`Failed to update ${repo.alias}: ${err as string}`, "error");
    }
  };

  const renderNode = (node: TreeNode) => {
    const isDir = node.type === "directory";

    return (
      <TreeItem
        key={node.path}
        itemId={node.path}
        label={
          <Box display="flex" alignItems="center" gap={1}>
            {isDir ? <FolderIcon fontSize="small" /> : <InsertDriveFileIcon fontSize="small" />}
            <Typography variant="body2" noWrap>
              {node.name}
            </Typography>
          </Box>
        }
        onClick={() => handleFileClick(node)}
      >
        {isDir && node.children?.map(renderNode)}
      </TreeItem>
    );
  };

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: "hidden" }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title={repo.alias}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 500 }}>
              {repo.alias}
            </Typography>
          </Tooltip>
        </Box>

        {repo.deployed_ref && !isDeveloper && (
          <Chip icon={<CustomGitIcon />} size="small" label={shortRef(repo.deployed_ref)} />
        )}

        {isDeveloper && (
          <>
            <CustomGitIcon fontSize="small" />
            <Tooltip placement="top" title={"Checked-out ref"}>
              <Select
                size="small"
                value={selectedRef}
                onChange={(e) => void handleRefChange(e.target.value)}
                renderValue={(value) => shortRef(value)} // only show text when closed
                sx={{
                  minWidth: 14 * REF_MAX_DISPLAY_SIZE,
                  maxWidth: 14 * REF_MAX_DISPLAY_SIZE,
                  fontSize: "0.75rem",
                }}
              >
                {repo.refs?.map((ref) => (
                  <MenuItem
                    key={ref}
                    value={ref}
                    sx={{ color: ref === repo.deployed_ref ? "green" : undefined }}
                  >
                    <Box display="flex" flexDirection="column">
                      <Typography variant="inherit">{shortRef(ref)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ref === repo.deployed_ref ? "Deployed" : null}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Tooltip>

            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>

            <Menu anchorEl={menuAnchor} open={menuOpen} onClose={() => setMenuAnchor(null)}>
              <Tooltip title="Commit and push current changes">
                <MenuItem disabled>
                  <CommitIcon fontSize="small" sx={{ mr: 1 }} />
                  Commit
                </MenuItem>
              </Tooltip>
              <Tooltip title="Sync repo with remote (fetch)">
                <MenuItem onClick={() => void handleSyncClick()}>
                  <SyncIcon fontSize="small" sx={{ mr: 1 }} />
                  Sync
                </MenuItem>
              </Tooltip>
              <Tooltip title="Deploy this version to operators">
                <MenuItem onClick={() => void handleDeploy()} disabled={!selectedRef}>
                  <CloudUploadIcon fontSize="small" sx={{ mr: 1 }} />
                  Deploy
                </MenuItem>
              </Tooltip>
            </Menu>
          </>
        )}
      </Box>

      <Divider />

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 1, py: 0.5 }}>
          <SimpleTreeView id={repo.id}>{repo.tree.map(renderNode)}</SimpleTreeView>
        </Box>
      </Collapse>
    </Paper>
  );
}
