use crate::error::AppError;
use crate::git::{BranchDiffStatus, BranchInfo, FileDiff, GitRepository};

#[tauri::command]
pub fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, AppError> {
    let repo = GitRepository::open(&repo_path)?;
    repo.list_branches()
}

#[tauri::command]
pub fn get_branch_diff_status(
    repo_path: String,
    base_branch: String,
) -> Result<BranchDiffStatus, AppError> {
    let repo = GitRepository::open(&repo_path)?;
    repo.get_branch_diff_status(&base_branch)
}

#[tauri::command]
pub fn get_branch_file_diff(
    repo_path: String,
    base_branch: String,
    file_path: String,
    old_path: Option<String>,
    context_lines: Option<u32>,
    ignore_whitespace: Option<bool>,
) -> Result<FileDiff, AppError> {
    let repo = GitRepository::open(&repo_path)?;
    let context = context_lines.unwrap_or(3);
    let ignore_ws = ignore_whitespace.unwrap_or(false);
    repo.get_branch_file_diff(
        &base_branch,
        &file_path,
        old_path.as_deref(),
        context,
        ignore_ws,
    )
}
