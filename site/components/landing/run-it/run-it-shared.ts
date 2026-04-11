export const RUN_IT_REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const RUN_IT_EVALS_TREE_URL = `${RUN_IT_REPO}/tree/main/evals`;

export const RUN_IT_EXPERIMENT_LOG_URL = `${RUN_IT_REPO}/blob/main/evals/EXPERIMENT-LOG.md`;

export const RUN_IT_QUICKSTART_SNIPPET = `# 1. Clone the repo
git clone ${RUN_IT_REPO}
cd get-anything-done

# 2. See available eval projects
node bin/gad.cjs eval list

# 3. Bootstrap an agent prompt for one project
node bin/gad.cjs eval bootstrap escape-the-dungeon-bare

# 4. Run an eval (creates an isolated git worktree)
node bin/gad.cjs eval run escape-the-dungeon-bare

# 5. After the agent finishes, preserve and verify
node bin/gad.cjs eval preserve escape-the-dungeon-bare v4 --from <worktree>
node bin/gad.cjs eval verify`;
