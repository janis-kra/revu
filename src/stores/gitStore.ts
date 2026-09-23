import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  FileEntry,
  FileDiff,
  RepositoryStatus,
  ReviewMode,
  BranchInfo,
  BranchDiffStatus,
} from "@/types/git";

interface DemoState {
  status: RepositoryStatus;
  diffs: Record<string, FileDiff>;
}

interface GitState {
  repoPath: string | null;
  status: RepositoryStatus | null;
  selectedFile: FileEntry | null;
  currentDiff: FileDiff | null;
  isLoading: boolean;
  error: string | null;
  isDemo: boolean;
  _demoState: DemoState | null;

  // Branch review mode
  reviewMode: ReviewMode;
  branches: BranchInfo[];
  baseBranch: string | null;
  branchStatus: BranchDiffStatus | null;

  setRepoPath: (path: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  selectFile: (
    file: FileEntry | null,
    fullContext?: boolean,
    ignoreWhitespace?: boolean,
  ) => Promise<void>;
  fetchDiff: (fullContext: boolean, ignoreWhitespace: boolean) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<string>;
  discardFile: (filePath: string) => Promise<void>;
  discardAll: () => Promise<void>;
  clearError: () => void;
  // Demo mode - accepts pre-built demo state
  initDemoMode: (demoState: DemoState) => void;

  // Branch review
  setReviewMode: (mode: ReviewMode) => Promise<void>;
  setBaseBranch: (branch: string) => Promise<void>;
  loadBranches: () => Promise<void>;
  refreshBranchStatus: () => Promise<void>;
}

function pickDefaultBaseBranch(
  branches: BranchInfo[],
  currentBranch?: string | null,
): string | null {
  const candidates = ["main", "master", "develop", "dev"];
  const nonHead = branches.filter((b) => !b.isHead && b.name !== currentBranch);

  for (const name of candidates) {
    const local = nonHead.find((b) => !b.isRemote && b.name === name);
    if (local) return local.name;
  }

  for (const name of candidates) {
    const remote = nonHead.find(
      (b) => b.isRemote && (b.name === `origin/${name}` || b.name.endsWith(`/${name}`)),
    );
    if (remote) return remote.name;
  }

  // Prefer a local non-head branch
  const local = nonHead.find((b) => !b.isRemote);
  if (local) return local.name;

  return nonHead[0]?.name ?? null;
}

export const useGitStore = create<GitState>()((set, get) => ({
  repoPath: null,
  status: null,
  selectedFile: null,
  currentDiff: null,
  isLoading: false,
  error: null,
  isDemo: false,
  _demoState: null,

  reviewMode: "working",
  branches: [],
  baseBranch: null,
  branchStatus: null,

  initDemoMode: (demoState: DemoState) => {
    const { status, diffs } = demoState;
    const firstFile = status.files.find((f) => !f.staged) || status.files[0];
    const diff = firstFile ? diffs[firstFile.path] || null : null;

    set({
      isDemo: true,
      _demoState: demoState,
      repoPath: status.path,
      status,
      selectedFile: firstFile || null,
      currentDiff: diff,
      isLoading: false,
      error: null,
      reviewMode: "working",
      branches: status.branch
        ? [
            { name: status.branch, isHead: true, isRemote: false },
            { name: "main", isHead: false, isRemote: false },
          ]
        : [{ name: "main", isHead: false, isRemote: false }],
      baseBranch: "main",
      branchStatus: null,
    });
  },

  setRepoPath: async (path: string) => {
    const { isDemo } = get();
    if (isDemo) return; // Ignore in demo mode

    set({
      repoPath: path,
      isLoading: true,
      error: null,
      selectedFile: null,
      currentDiff: null,
      reviewMode: "working",
      branchStatus: null,
      baseBranch: null,
      branches: [],
    });
    try {
      const status = await invoke<RepositoryStatus>("get_status", {
        repoPath: path,
      });
      set({ status, isLoading: false });

      // Prefetch branches so mode switch is snappy
      const branches = await invoke<BranchInfo[]>("list_branches", {
        repoPath: path,
      });
      const baseBranch = pickDefaultBaseBranch(branches, status.branch);
      set({ branches, baseBranch });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  refreshStatus: async () => {
    const { repoPath, isDemo, reviewMode } = get();
    if (!repoPath || isDemo) return; // Ignore in demo mode

    if (reviewMode === "branch") {
      await get().refreshBranchStatus();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const status = await invoke<RepositoryStatus>("get_status", { repoPath });
      set({ status, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  selectFile: async (
    file: FileEntry | null,
    fullContext = false,
    ignoreWhitespace = false,
  ) => {
    const {
      repoPath,
      isDemo,
      _demoState,
      reviewMode,
      baseBranch,
    } = get();
    if (!repoPath) return;

    set({ selectedFile: file, currentDiff: null });

    if (file) {
      // In demo mode, use pre-built diff data
      if (isDemo && _demoState) {
        const diff = _demoState.diffs[file.path] || null;
        set({ currentDiff: diff });
        return;
      }

      try {
        let diff: FileDiff;
        if (reviewMode === "branch" && baseBranch) {
          diff = await invoke<FileDiff>("get_branch_file_diff", {
            repoPath,
            baseBranch,
            filePath: file.path,
            oldPath: file.oldPath ?? null,
            contextLines: fullContext ? 999999 : null,
            ignoreWhitespace: ignoreWhitespace || null,
          });
        } else {
          diff = await invoke<FileDiff>("get_file_diff", {
            repoPath,
            filePath: file.path,
            staged: file.staged,
            contextLines: fullContext ? 999999 : null,
            ignoreWhitespace: ignoreWhitespace || null,
          });
        }
        set({ currentDiff: diff });
      } catch (e) {
        set({ error: String(e) });
      }
    }
  },

  fetchDiff: async (fullContext: boolean, ignoreWhitespace: boolean) => {
    const {
      repoPath,
      selectedFile,
      isDemo,
      _demoState,
      reviewMode,
      baseBranch,
    } = get();
    if (!repoPath || !selectedFile) return;

    // In demo mode, just return the existing diff
    if (isDemo && _demoState) {
      const diff = _demoState.diffs[selectedFile.path] || null;
      set({ currentDiff: diff });
      return;
    }

    try {
      let diff: FileDiff;
      if (reviewMode === "branch" && baseBranch) {
        diff = await invoke<FileDiff>("get_branch_file_diff", {
          repoPath,
          baseBranch,
          filePath: selectedFile.path,
          oldPath: selectedFile.oldPath ?? null,
          contextLines: fullContext ? 999999 : null,
          ignoreWhitespace: ignoreWhitespace || null,
        });
      } else {
        diff = await invoke<FileDiff>("get_file_diff", {
          repoPath,
          filePath: selectedFile.path,
          staged: selectedFile.staged,
          contextLines: fullContext ? 999999 : null,
          ignoreWhitespace: ignoreWhitespace || null,
        });
      }
      set({ currentDiff: diff });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  stageFile: async (filePath: string) => {
    const { repoPath, refreshStatus, selectFile, selectedFile, isDemo, reviewMode } =
      get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("stage_file", { repoPath, filePath });
      await refreshStatus();
      if (selectedFile?.path === filePath) {
        const newStatus = get().status;
        const newFile = newStatus?.files.find(
          (f) => f.path === filePath && f.staged,
        );
        if (newFile) await selectFile(newFile);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unstageFile: async (filePath: string) => {
    const { repoPath, refreshStatus, selectFile, selectedFile, isDemo, reviewMode } =
      get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("unstage_file", { repoPath, filePath });
      await refreshStatus();
      if (selectedFile?.path === filePath) {
        const newStatus = get().status;
        const newFile = newStatus?.files.find(
          (f) => f.path === filePath && !f.staged,
        );
        if (newFile) await selectFile(newFile);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  stageAll: async () => {
    const { repoPath, refreshStatus, isDemo, reviewMode } = get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("stage_all", { repoPath });
      await refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unstageAll: async () => {
    const { repoPath, refreshStatus, isDemo, reviewMode } = get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("unstage_all", { repoPath });
      await refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  commit: async (message: string) => {
    const { repoPath, refreshStatus, isDemo, reviewMode } = get();
    if (!repoPath) throw new Error("No repository");
    if (isDemo) return "demo-commit-oid"; // Mock in demo mode
    if (reviewMode === "branch") throw new Error("Cannot commit in branch review mode");

    const oid = await invoke<string>("commit", { repoPath, message });
    await refreshStatus();
    set({ selectedFile: null, currentDiff: null });
    return oid;
  },

  discardFile: async (filePath: string) => {
    const { repoPath, refreshStatus, selectedFile, isDemo, reviewMode } = get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("discard_file", { repoPath, filePath });
      await refreshStatus();
      if (selectedFile?.path === filePath) {
        set({ selectedFile: null, currentDiff: null });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  discardAll: async () => {
    const { repoPath, refreshStatus, isDemo, reviewMode } = get();
    if (!repoPath || isDemo || reviewMode === "branch") return;

    try {
      await invoke("discard_all", { repoPath });
      await refreshStatus();
      set({ selectedFile: null, currentDiff: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearError: () => set({ error: null }),

  loadBranches: async () => {
    const { repoPath, isDemo, status, baseBranch } = get();
    if (!repoPath || isDemo) return;

    try {
      const branches = await invoke<BranchInfo[]>("list_branches", { repoPath });
      const nextBase =
        baseBranch && branches.some((b) => b.name === baseBranch)
          ? baseBranch
          : pickDefaultBaseBranch(branches, status?.branch);
      set({ branches, baseBranch: nextBase });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshBranchStatus: async () => {
    const { repoPath, baseBranch, isDemo, selectedFile } = get();
    if (!repoPath || !baseBranch || isDemo) return;

    set({ isLoading: true, error: null });
    try {
      const branchStatus = await invoke<BranchDiffStatus>(
        "get_branch_diff_status",
        { repoPath, baseBranch },
      );

      // Keep selection if the file still exists in the branch diff.
      // Clear currentDiff so DiffViewer re-fetches with current UI options.
      let nextSelected: FileEntry | null = null;
      if (selectedFile) {
        nextSelected =
          branchStatus.files.find((f) => f.path === selectedFile.path) ?? null;
      }

      set({
        branchStatus,
        selectedFile: nextSelected,
        currentDiff: null,
        isLoading: false,
      });
    } catch (e) {
      set({ error: String(e), isLoading: false, branchStatus: null });
    }
  },

  setReviewMode: async (mode: ReviewMode) => {
    const { reviewMode, isDemo, baseBranch, status, _demoState } = get();
    if (mode === reviewMode) return;

    set({
      reviewMode: mode,
      selectedFile: null,
      currentDiff: null,
      error: null,
    });

    if (isDemo) {
      if (mode === "branch" && status && _demoState) {
        // Demo: treat all working-tree files as branch changes vs main
        const files = status.files.map((f) => ({ ...f, staged: false }));
        set({
          baseBranch: baseBranch ?? "main",
          branchStatus: {
            baseBranch: baseBranch ?? "main",
            headBranch: status.branch,
            files,
            aheadCount: 3,
            behindCount: 0,
          },
        });
        if (files.length > 0) {
          await get().selectFile(files[0]);
        }
      }
      return;
    }

    if (mode === "branch") {
      await get().loadBranches();
      const branch = get().baseBranch ?? baseBranch;
      if (branch) {
        await get().refreshBranchStatus();
        // Auto-select first file
        const files = get().branchStatus?.files;
        if (files && files.length > 0) {
          await get().selectFile(files[0]);
        }
      }
    } else {
      await get().refreshStatus();
    }
  },

  setBaseBranch: async (branch: string) => {
    const { isDemo, reviewMode, status, _demoState } = get();
    set({ baseBranch: branch, selectedFile: null, currentDiff: null });

    if (isDemo) {
      if (reviewMode === "branch" && status && _demoState) {
        const files = status.files.map((f) => ({ ...f, staged: false }));
        set({
          branchStatus: {
            baseBranch: branch,
            headBranch: status.branch,
            files,
            aheadCount: 3,
            behindCount: 0,
          },
        });
        if (files.length > 0) {
          await get().selectFile(files[0]);
        }
      }
      return;
    }

    if (reviewMode !== "branch") return;

    await get().refreshBranchStatus();
    const files = get().branchStatus?.files;
    if (files && files.length > 0) {
      await get().selectFile(files[0]);
    }
  },
}));
