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
import Collapse from "@mui/material/Collapse";

import { useState } from "react";
import {
  checkoutRepoRef,
  deployRepo,
  type RepoTreeInfo,
  type TreeNode,
} from "@src/services/APIClient";
import CustomGitIcon from "@src/components/CustomIcons/GitIcon";
import { useEditorContext } from "@src/context/useEditorContext";
import { notifyUser } from "@src/services/Notifications/Notification";

export interface RepoTreeProps {
  repoTreeList: RepoTreeInfo[];
}

export default function FileTree({ repoTreeList }: RepoTreeProps) {
  return (
    <Box sx={{ height: "100%", overflowY: "auto" }}>
      {repoTreeList.map((repo) => (
        <ProjectSection key={repo.id} repo={repo} />
      ))}
    </Box>
  );
}

function ProjectSection({ repo }: { repo: RepoTreeInfo }) {
  const REF_MAX_DISPLAY_SIZE = 7;
  const currentRef = repo.deployed_ref ?? repo.refs?.[0] ?? "";

  const { isDeveloper, fetchRepoTreeList } = useEditorContext();

  const [expanded, setExpanded] = useState(true);
  const [selectedRef, setSelectedRef] = useState(currentRef);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const menuOpen = Boolean(menuAnchor);

  const handleRefChange = async (ref: string) => {
    try {
      const res = await checkoutRepoRef({
        path: { repo_id: repo.id },
        query: { ref: ref },
      }).then((r) => r.data);
      if (res.ref === ref) {
        await fetchRepoTreeList();
        setSelectedRef(ref);
        notifyUser(`Success: HEAD at ${ref}`, "success");
      } else {
        throw new Error("Invalid checkout data received from server - contact support");
      }
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
      if (res.repo_id === repo.id && res.commit_hash === selectedRef) {
        notifyUser(`Successfully deployed ${repo.alias}@${selectedRef}`, "success");
      } else {
        throw new Error("Invalid deployment data received from server - contact support");
      }
    } catch (err) {
      notifyUser(`Failed to deploy repo: ${err as string}`, "error");
    }
    setMenuAnchor(null);
  };

  const handleFileSelect = (node: TreeNode) => {
    if (node.type !== "file") return;
    // TODO: fetch file content
    console.log("Fetch file:", repo.id, node.path);
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
        onClick={() => handleFileSelect(node)}
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
          cursor: "pointer",
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded((v) => !v)}>
          <Tooltip title={repo.alias}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 500 }}>
              {repo.alias}
            </Typography>
          </Tooltip>
        </Box>
        {repo.deployed_ref && !isDeveloper && (
          <Chip
            icon={<CustomGitIcon />}
            size="small"
            label={`${repo.deployed_ref.substring(0, REF_MAX_DISPLAY_SIZE)}`}
            sx={{ mt: 0.5 }}
          />
        )}

        {isDeveloper && (
          <>
            <CustomGitIcon fontSize="small" />

            <Select
              size="small"
              value={selectedRef}
              onChange={(e) => void handleRefChange(e.target.value)}
              displayEmpty
              sx={{
                minWidth: 12.5 * REF_MAX_DISPLAY_SIZE,
                maxWidth: 12.5 * REF_MAX_DISPLAY_SIZE,
                fontSize: "0.75rem",
                "& .MuiSelect-select": {
                  py: 0.5,
                  px: 1,
                },
              }}
            >
              {repo.refs?.map((ref) => (
                <MenuItem key={ref} value={ref}>
                  {ref.substring(0, REF_MAX_DISPLAY_SIZE)}
                </MenuItem>
              ))}
            </Select>

            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" sx={{ pointerEvents: "none" }} />
            </IconButton>

            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem disabled>Commit</MenuItem>
              <MenuItem onClick={() => void handleDeploy()} disabled={!selectedRef}>
                <CloudUploadIcon fontSize="small" sx={{ mr: 1 }} />
                Deploy
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      <Divider />

      {/* Tree */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 1, py: 0.5 }}>
          <SimpleTreeView>{repo.tree.map(renderNode)}</SimpleTreeView>
        </Box>
      </Collapse>
    </Paper>
  );
}
