import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { Box, Typography } from "@mui/material";
import type { RepoTreeInfo, TreeNode } from "@src/services/APIClient";

export interface RepoTreeProps {
  repoTreeList: RepoTreeInfo[];
  onSelect?: (node: TreeNode) => void;
}

export default function RepoTree({ repoTreeList, onSelect }: RepoTreeProps) {
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
        onClick={() => onSelect?.(node)}
      >
        {isDir && node.children?.map((child) => renderNode(child))}
      </TreeItem>
    );
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <SimpleTreeView>
          {Object.values(repoTreeList).map((repo: RepoTreeInfo) => (
            <TreeItem key={repo.id} itemId={repo.id} label={repo.alias}>
              {repo.tree.map((node: TreeNode) => renderNode(node))}
            </TreeItem>
          ))}
        </SimpleTreeView>
      </Box>
    </Box>
  );
}
