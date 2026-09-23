import { useMemo } from "react";
import { useGitStore } from "@/stores/gitStore";
import { useCommentStore } from "@/stores/commentStore";
import { Button } from "@/components/ui";
import { FileItem } from "./FileItem";

export function FileList() {
  const {
    status,
    selectedFile,
    selectFile,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    reviewMode,
    branchStatus,
    branches,
    baseBranch,
    setBaseBranch,
    setReviewMode,
  } = useGitStore();
  const comments = useCommentStore((state) => state.comments);
  const currentRepoPath = useCommentStore((state) => state.currentRepoPath);

  const isBranchMode = reviewMode === "branch";

  const { stagedFiles, unstagedFiles, branchFiles } = useMemo(() => {
    if (isBranchMode) {
      return {
        stagedFiles: [],
        unstagedFiles: [],
        branchFiles: branchStatus?.files ?? [],
      };
    }

    if (!status) {
      return { stagedFiles: [], unstagedFiles: [], branchFiles: [] };
    }

    const staged = status.files.filter((f) => f.staged);
    const unstaged = status.files.filter((f) => !f.staged);

    return { stagedFiles: staged, unstagedFiles: unstaged, branchFiles: [] };
  }, [status, branchStatus, isBranchMode]);

  const commentCountByFile = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!currentRepoPath) return counts;
    const repoComments = comments[currentRepoPath] || {};
    for (const [filePath, fileComments] of Object.entries(repoComments)) {
      counts[filePath] = fileComments.length;
    }
    return counts;
  }, [comments, currentRepoPath]);

  const selectableBranches = useMemo(() => {
    // Don't offer current HEAD as a base — three-dot would be empty
    return branches.filter((b) => !b.isHead);
  }, [branches]);

  const handleStageToggle = (file: (typeof stagedFiles)[0]) => {
    if (file.staged) {
      unstageFile(file.path);
    } else {
      stageFile(file.path);
    }
  };

  const modeToggle = (
    <div className="flex-shrink-0 px-2 py-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
        <button
          onClick={() => setReviewMode("working")}
          className={`flex-1 px-2 py-1 text-xs font-medium ${
            !isBranchMode
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Working Tree
        </button>
        <button
          onClick={() => setReviewMode("branch")}
          className={`flex-1 px-2 py-1 text-xs font-medium ${
            isBranchMode
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          Branch
        </button>
      </div>

      {isBranchMode && (
        <div className="mt-2 space-y-1.5">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Compare against
          </label>
          <select
            value={baseBranch ?? ""}
            onChange={(e) => setBaseBranch(e.target.value)}
            disabled={selectableBranches.length === 0}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            {selectableBranches.length === 0 && (
              <option value="">No other branches</option>
            )}
            {selectableBranches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.isRemote ? " (remote)" : ""}
              </option>
            ))}
          </select>
          {branchStatus && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {branchStatus.aheadCount > 0 || branchStatus.behindCount > 0 ? (
                <>
                  {branchStatus.aheadCount > 0 && (
                    <span>
                      {branchStatus.aheadCount} commit
                      {branchStatus.aheadCount !== 1 ? "s" : ""} ahead
                    </span>
                  )}
                  {branchStatus.aheadCount > 0 &&
                    branchStatus.behindCount > 0 &&
                    " · "}
                  {branchStatus.behindCount > 0 && (
                    <span>
                      {branchStatus.behindCount} behind
                    </span>
                  )}
                </>
              ) : (
                <span>Same commit as base</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (!status && !isBranchMode) {
    return (
      <div className="h-full flex flex-col">
        {modeToggle}
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">No repository loaded</p>
        </div>
      </div>
    );
  }

  if (isBranchMode) {
    if (!baseBranch) {
      return (
        <div className="h-full flex flex-col">
          {modeToggle}
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 px-4 text-center">
            <p className="text-sm">
              No base branch available. Create or fetch another branch to
              compare.
            </p>
          </div>
        </div>
      );
    }

    if (branchFiles.length === 0) {
      return (
        <div className="h-full flex flex-col">
          {modeToggle}
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 px-4 text-center">
            <p className="text-sm">
              No changes between this branch and{" "}
              <span className="font-medium">{baseBranch}</span>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {modeToggle}
        <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800/50">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Branch changes ({branchFiles.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {branchFiles.map((file) => (
            <FileItem
              key={`branch-${file.path}`}
              file={file}
              isSelected={selectedFile?.path === file.path}
              onSelect={() => selectFile(file)}
              commentCount={commentCountByFile[file.path] || 0}
              showStageCheckbox={false}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!status || status.files.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {modeToggle}
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">No changes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {modeToggle}

      {stagedFiles.length > 0 && (
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Staged ({stagedFiles.length})
            </span>
            <Button variant="ghost" size="sm" onClick={unstageAll}>
              Unstage All
            </Button>
          </div>
          <div className="py-1">
            {stagedFiles.map((file) => (
              <FileItem
                key={`staged-${file.path}`}
                file={file}
                isSelected={
                  selectedFile?.path === file.path &&
                  selectedFile?.staged === file.staged
                }
                onSelect={() => selectFile(file)}
                onStageToggle={() => handleStageToggle(file)}
                commentCount={commentCountByFile[file.path] || 0}
              />
            ))}
          </div>
        </div>
      )}

      {unstagedFiles.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Changes ({unstagedFiles.length})
            </span>
            <Button variant="ghost" size="sm" onClick={stageAll}>
              Stage All
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {unstagedFiles.map((file) => (
              <FileItem
                key={`unstaged-${file.path}`}
                file={file}
                isSelected={
                  selectedFile?.path === file.path &&
                  selectedFile?.staged === file.staged
                }
                onSelect={() => selectFile(file)}
                onStageToggle={() => handleStageToggle(file)}
                commentCount={commentCountByFile[file.path] || 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
