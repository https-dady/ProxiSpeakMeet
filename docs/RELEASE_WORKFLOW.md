# Git and Release Workflow

## Recommended branch responsibilities

Use `main` as the stable integration/release branch and `tarun` as the development branch only if that remains your team's chosen workflow. Confirm branch names with `git branch -a`; the archive itself does not prove current remote branch state.

## Before committing

```bash
git status --short --branch
git diff --check
git diff --stat
git diff
```

Run tests/build relevant to the change.

## Commit and push development

```bash
git add <specific-paths>
git commit -m "type: concise change description"
git push origin tarun
```

Prefer explicit file paths over `git add .` when the working tree may contain generated or accidental files.

## Pull request: tarun → main

1. Open repository → Pull requests → New pull request.
2. Base: `main`.
3. Compare: `tarun`.
4. Review commits and Files changed.
5. Check for secrets, `.env`, build artifacts, accidental files and unrelated changes.
6. Confirm CI/test checks.
7. Create PR and merge only after review.
8. Confirm GitHub labels the PR **Merged**.

A compare page that says “Able to merge” means GitHub sees no merge conflict; it does not mean the PR has already merged.

## Update local main after merge

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git status --short --branch
git log --oneline --decorate -5
```

If local main has unpushed commits or a diverged history, stop and inspect before resetting.

## Safe rollback

Before moving a branch pointer:

```bash
git status
git branch backup-before-reset
git log --oneline --decorate -10
```

`git reset --hard HEAD~N` moves the current branch back and discards tracked uncommitted work. It does not mean “remove a version from GitHub” until a push updates the remote; force-pushing shared history can disrupt collaborators.

For already-published commits, prefer:
```bash
git revert <commit-sha>
```

## Release checklist

- [ ] PR merged into intended base branch.
- [ ] Local main updated from origin/main.
- [ ] Working tree clean.
- [ ] Automated tests pass.
- [ ] Production client build passes.
- [ ] Environment variables configured in hosting provider.
- [ ] `/health` and `/api/health` pass.
- [ ] Auth, refresh and logout tested.
- [ ] Public/private room permissions tested.
- [ ] Two-browser WebRTC and spatial-audio test passes.
- [ ] Deployment logs reviewed.
- [ ] Rollback commit/deployment identified.
