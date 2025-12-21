import os
from pydantic import BaseModel
from typing import List, Optional

REPOS_BASE_PATH = os.getenv("REPOS_BASE_PATH", "../data/repos")
STAGING_REL_FOLDER = "staging"
DEPLOYMENTS_REL_FOLDER = "deployments"
SNAPSHOT_REL_FOLDER = "snapshot"
CURRENT_SYMLINK = "current"
DEPLOYMENT_META = "deployment.json"
REPO_META = "repo.json"

os.makedirs(REPOS_BASE_PATH, exist_ok=True)


class TreeNode(BaseModel):
    name: str
    path: str  # path relative to repo/snapshot root
    type: str  # "file" | "directory"
    children: Optional[List["TreeNode"]] = None


class TreeResponse(BaseModel):
    path: str
    entries: List[TreeNode]


class FileResponse(BaseModel):
    path: str
    content: str
    encoding: str = "utf-8"


def build_full_tree(root_path: str, rel_path: str = "") -> List[TreeNode]:
    """
    Recursively build a directory tree starting at root_path/rel_path.

    - Skips metadata directories (e.g. .git)
    - Includes only .json files
    - Paths are returned relative to root_path
    """
    abs_path = os.path.join(root_path, rel_path)
    nodes: List[TreeNode] = []
    IGNORE_DIRS = {".git", ".hg", ".svn", "__pycache__"}
    try:
        entries = sorted(
            os.scandir(abs_path),
            key=lambda e: (not e.is_dir(follow_symlinks=False), e.name),
        )
    except FileNotFoundError:
        return []

    for entry in entries:
        if entry.is_dir(follow_symlinks=False) and entry.name in IGNORE_DIRS:
            continue

        entry_rel_path = os.path.join(rel_path, entry.name)

        if entry.is_dir(follow_symlinks=False):
            children = build_full_tree(root_path, entry_rel_path)
            if children:  # avoid empty directories
                nodes.append(
                    TreeNode(
                        name=entry.name,
                        path=entry_rel_path,
                        type="directory",
                        children=children,
                    )
                )
        else:
            if not entry.name.lower().endswith(".json"):
                continue

            nodes.append(
                TreeNode(
                    name=entry.name,
                    path=entry_rel_path,
                    type="file",
                )
            )

    return nodes
