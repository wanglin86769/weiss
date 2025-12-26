import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export interface RepoTreeProps {
  root: TreeNode;
  onSelect?: (node: TreeNode) => void;
}

export default function RepoTree({ root, onSelect }: RepoTreeProps) {
  const renderNode = (node: TreeNode) => {
    const isDir = node.type === "directory";

    return (
      <TreeItem
        key={node.path}
        itemId={node.path}
        label={node.name}
        onClick={() => onSelect?.(node)}
        slots={{
          icon: isDir ? FolderIcon : InsertDriveFileIcon,
        }}
      >
        {node.children?.map(renderNode)}
      </TreeItem>
    );
  };

  return (
    <SimpleTreeView
      slots={{
        expandIcon: ChevronRightIcon,
        collapseIcon: ExpandMoreIcon,
      }}
      sx={{
        flexGrow: 1,
        overflowY: "auto",
      }}
    >
      {renderNode(root)}
    </SimpleTreeView>
  );
}
