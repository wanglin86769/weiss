import os
import uuid
import subprocess
import json
from .common import REPOS_BASE_PATH
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
from api.repos.common import (
    TreeNode,
    RepoInfo,
    RepoTreeInfo,
    DeploymentInfo,
    build_path_tree,
    list_all_repositories,
    DEPLOYMENTS_REL_FOLDER,
    STAGING_REL_FOLDER,
    CURRENT_SYMLINK,
    REPO_META,
)

router = APIRouter(
    prefix="/api/v1/repos/staging",
    tags=["[Admin] OPI management"],
)


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RepoCreateRequest(BaseModel):
    alias: str = Field(..., description="Local OPI repository name")
    git_url: str = Field(..., description="Git repository URL")


class RepoRefInfo(BaseModel):
    ref: str
    commit_hash: str


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []


class DeployRequest(BaseModel):
    deployment_version: str  # tag or commit hash to deploy


# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
def run_git(cmd: list, cwd: str = None):
    """Run git command and raise exception on failure"""
    try:
        result = subprocess.run(["git"] + cmd, cwd=cwd, check=True, capture_output=True, text=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Git command failed: {e.stderr}")


def clone_or_fetch(git_url: str, repo_id: str) -> str:
    repo_path = os.path.join(REPOS_BASE_PATH, repo_id, STAGING_REL_FOLDER)
    if not os.path.exists(repo_path):
        os.makedirs(os.path.dirname(repo_path), exist_ok=True)
        run_git(["clone", "--recursive", git_url, repo_path])
    else:
        run_git(["fetch", "--all", "--tags", "--prune"], cwd=repo_path)
    return repo_path


def create_snapshot(repo_id: str, ref: str) -> str:
    """
    Create a read-only snapshot of the repo at a given ref.

    Returns:
        deployment_id, snapshot_path
    """
    repo_path = os.path.join(REPOS_BASE_PATH, repo_id, STAGING_REL_FOLDER)
    deployment_id = str(uuid.uuid4())
    deployments_root = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER)
    os.makedirs(deployments_root, exist_ok=True)
    deployment_path = os.path.join(deployments_root, deployment_id)
    print(f"Creating snapshot at {deployment_path}")
    run_git(["clone", "--recursive", repo_path, deployment_path])
    run_git(["checkout", ref], cwd=deployment_path)

    return deployment_id, deployment_path


def validate_repo_content(repo_path: str, ref: str) -> ValidationResult:
    """Validate that the repo at given ref contains required OPI files"""
    # @TODO
    return ValidationResult(valid=True, errors=[])


def get_staging_path(repo_id: str) -> str:
    repo_path = os.path.join(REPOS_BASE_PATH, repo_id, STAGING_REL_FOLDER)
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo_path


@router.get("/", response_model=List[RepoInfo])
def list_repositories():
    return list_all_repositories()


@router.get("/tree", response_model=List[RepoTreeInfo])
def get_all_repos_tree():
    all_trees = []
    for repo in list_all_repositories():
        repo_path = get_staging_path(repo.id)
        tree = build_path_tree(repo_path)
        all_trees.append(RepoTreeInfo(**repo.model_dump(), tree=tree))
    return all_trees


@router.post("/register", response_model=RepoInfo)
def register_repository(payload: RepoCreateRequest):
    """Register a Git repository and create a clone"""
    repo_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)

    try:
        clone_or_fetch(payload.git_url, repo_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    meta_file = os.path.join(REPOS_BASE_PATH, repo_id, "repo.json")
    meta_data = {
        "id": repo_id,
        "alias": payload.alias,
        "git_url": payload.git_url,
        "created_at": created_at.isoformat(),
    }
    with open(meta_file, "w") as f:
        json.dump(meta_data, f)

    return RepoInfo(**meta_data)


@router.get("/{repo_id}/refs", response_model=List[RepoRefInfo])
def list_repository_refs(repo_id: str):
    repo_path = get_staging_path(repo_id)
    tags_output = run_git(["tag"], cwd=repo_path)
    tags = tags_output.splitlines() if tags_output else []

    return [
        RepoRefInfo(
            ref=t,
            commit_hash=run_git(["rev-parse", t], cwd=repo_path),
        )
        for t in tags
    ]


@router.post("/{repo_id}/update")
def update_repo(repo_id: str):
    """Fetch new tags/commits from remote without deploying"""
    repo_path = get_staging_path(repo_id)
    run_git(["fetch", "--all", "--tags", "--prune"], cwd=repo_path)
    return {"message": "Fetched latest remote versions"}


@router.post("/{repo_id}/deploy", response_model=DeploymentInfo)
def deploy_repo(repo_id: str, payload: DeployRequest):
    """Deploy a selected tag or commit to make it available for users"""
    meta_file = os.path.join(REPOS_BASE_PATH, repo_id, REPO_META)
    if not os.path.exists(meta_file):
        raise HTTPException(status_code=404, detail="Repository not found")

    with open(meta_file) as f:
        repo_meta = json.load(f)

    repo_path = get_staging_path(repo_id)
    ref_to_deploy = payload.deployment_version

    try:
        deployment_id, snapshot_path = create_snapshot(repo_id, ref_to_deploy)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot: {str(e)}")

    commit_hash = run_git(["rev-parse", ref_to_deploy], cwd=repo_path)

    deployment_meta = {
        "deployment_id": deployment_id,
        "repo_id": repo_id,
        "ref": ref_to_deploy,
        "commit_hash": commit_hash,
        "deployed_at": datetime.now(timezone.utc).isoformat(),
    }
    deployment_meta_path = os.path.join(
        REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, deployment_id, "deployment.json"
    )
    with open(deployment_meta_path, "w") as f:
        json.dump(deployment_meta, f, indent=2)

    repo_meta["current_deployment"] = deployment_id
    repo_meta["deployed_ref"] = ref_to_deploy
    repo_meta["deployed_at"] = deployment_meta["deployed_at"]

    with open(meta_file, "w") as f:
        json.dump(repo_meta, f, indent=2)
    # Update 'current' symlink
    current_link = os.path.join(REPOS_BASE_PATH, repo_id, DEPLOYMENTS_REL_FOLDER, CURRENT_SYMLINK)
    if os.path.islink(current_link) or os.path.exists(current_link):
        os.remove(current_link)
    os.symlink(snapshot_path, current_link)
    return DeploymentInfo(
        id=deployment_id,
        repo_id=repo_id,
        ref=ref_to_deploy,
        commit_hash=commit_hash,
        deployed_at=datetime.fromisoformat(deployment_meta["deployed_at"]),
    )


@router.get("/{repo_id}/checkout", response_model=RepoRefInfo)
def checkout_repo_ref(repo_id: str, ref: str):
    """Checkout a specific ref in the staging repo"""
    repo_path = get_staging_path(repo_id)
    try:
        run_git(["checkout", ref], cwd=repo_path)
        commit_hash = run_git(["rev-parse", ref], cwd=repo_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to checkout ref: {str(e)}")
    return RepoRefInfo(
        ref=ref,
        commit_hash=commit_hash,
    )


@router.get("/{repo_id}/tree", response_model=List[TreeNode])
def get_staging_repo_tree(repo_id: str):
    repo_path = get_staging_path(repo_id)
    return build_path_tree(repo_path)
