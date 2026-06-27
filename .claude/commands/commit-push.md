Stage all modified and untracked files relevant to the current work, commit using the message provided as $ARGUMENTS, and push to the current branch.

Steps:
1. Run `git status` to show what will be staged
2. Stage the relevant files specifically (never use `git add -A` or `git add .` — stage by explicit path)
3. Commit with the message: $ARGUMENTS — follow the project commit convention: `<type>(scope): Mx - description`
4. Push to the current branch with `git push`
5. Confirm the commit hash and pushed branch

If $ARGUMENTS is empty, complete that part based on the current work, following the project commit convention.
