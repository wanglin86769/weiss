import os
import json
from fastapi import APIRouter, HTTPException, Query
from typing import List
from datetime import datetime
from api.repos.common import (
    TreeNode,
    FileResponse,
    RepoInfo,
    DeploymentInfo,
    build_full_tree,
    list_all_repositories,
    REPOS_BASE_PATH,
    DEPLOYMENTS_REL_FOLDER,
    CURRENT_SYMLINK,
    DEPLOYMENT_META,
)

router = APIRouter(
    prefix="/api/v1/repos/runtime",
    tags=["OPI Repositories"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_current_snapshot_path(repo_id: str) -> str:
    """
    Resolve the path of the currently deployed snapshot for a repo.
    """
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    if not os.path.exists(current_link) or not os.path.islink(current_link):
        raise HTTPException(status_code=404, detail="No deployed snapshot available")
    return current_link


def get_current_deployment_meta(repo_id: str) -> dict:
    """
    Return the metadata from deployment.json for the current deployment.
    """
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    meta_file = os.path.join(current_link, DEPLOYMENT_META)
    if not os.path.exists(meta_file):
        raise HTTPException(status_code=404, detail="Deployment metadata not found")
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[RepoInfo])
def list_repositories():
    all_repos = list_all_repositories()
    repos_w_deployment: List[RepoInfo] = []
    for repo in all_repos:
        if repo.current_deployment is not None:
            repos_w_deployment.append(repo)
    return repos_w_deployment


@router.get("/{repo_id}/tree", response_model=List[TreeNode])
def get_runtime_repo_tree(repo_id: str):
    """
    Return the full tree of the currently deployed snapshot.
    """
    snapshot_path = get_current_snapshot_path(repo_id)
    return build_full_tree(snapshot_path)


@router.get("/{repo_id}/file", response_model=FileResponse)
def runtime_get_repo_file(
    repo_id: str, path: str = Query(..., description="Path to file inside repository")
):
    """
    Return the content of a file from the currently deployed snapshot.
    """
    snapshot_path = get_current_snapshot_path(repo_id)
    full_path = os.path.join(snapshot_path, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found in snapshot")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    return FileResponse(path=path, content=content)


@router.get("/{repo_id}/info", response_model=DeploymentInfo)
def get_current_deployment_info(repo_id: str):
    """
    Return information about the currently deployed snapshot.
    """
    meta = get_current_deployment_meta(repo_id)
    return DeploymentInfo(
        id=meta["deployment_id"],
        repo_id=meta["repo_id"],
        ref=meta["ref"],
        commit_hash=meta["commit_hash"],
        deployed_at=datetime.fromisoformat(meta["deployed_at"]),
    )
