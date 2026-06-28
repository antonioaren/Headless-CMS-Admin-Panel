---
name: simple-pr
description: "Stage all changes, commit with a user-provided message, push, and open a PR. Trigger: user says 'create a pr', 'push and open pr', or invokes /simple-pr."
license: Apache-2.0
metadata:
  author: pedro-arenas
  version: "1.0"
---

## When to Use

Use when the user wants to commit everything that's staged/unstaged, push the branch, and open a PR in one shot — without the issue-first gate.

Triggers:
- `/simple-pr <description>`
- "create a pr with description X"
- "push this and open a pr"

---

## Workflow

Execute these steps in order. Do NOT skip any.

### 1. Gather info

Run in parallel:
- `git status` — see what's modified/untracked
- `git log --oneline -5` — understand recent commit history and message style
- `git branch --show-current` — confirm current branch
- `gh auth status` — confirm GitHub CLI is authenticated

### 2. Stage files

Stage only relevant project files. Never use `git add -A` or `git add .`.

Exclude:
- `.env*` files
- Any file containing secrets or credentials
- Lock files unless they changed meaningfully (pnpm-lock.yaml changes alongside package.json are fine)

Stage everything else that appears modified or untracked in the diff using explicit paths.

### 3. Build the commit message

Use the project's commit convention from `.claude/rules/commit-convention.md`:

```
<type>(<scope>): Mx - <description>
```

- Derive `type` and `scope` from the files changed.
- Derive `Mx` from the current branch name (e.g. `feat/M1-schema-builder` → `M1`).
- Use the user-provided description as the commit body or inline in the subject line.
- No `Co-Authored-By` or AI attribution lines — ever.

### 4. Commit

```bash
git commit -m "<message>"
```

If the pre-commit hook fails: fix the issue, re-stage, create a NEW commit. Never use `--no-verify`.

### 5. Push

```bash
git push -u origin <current-branch>
```

If the remote already has the branch, just `git push`.

### 6. Open the PR

Use `gh pr create`. Target branch is `main` unless the user specifies otherwise.

PR body must include:
- **Summary**: what this PR does (use the user-provided description)
- **Changes**: bullet list of key files changed
- **Test plan**: what the reviewer should check manually

```bash
gh pr create \
  --title "<commit message subject>" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
<user description here>

## Changes
- <file> — <what changed>

## Test plan
- [ ] Run `pnpm dev` and verify the app starts
- [ ] Manually test the affected feature
EOF
)"
```

### 7. Return the PR URL

Print the PR URL so the user can open it directly.

---

## Rules

- Never add `Co-Authored-By` or AI attribution to commits.
- Never use `--no-verify` on hooks.
- Never `git add -A` — stage specific files.
- Always confirm the branch before pushing.
- If `gh` is not authenticated, stop and tell the user to run `gh auth login`.
