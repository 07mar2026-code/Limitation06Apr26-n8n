#!/bin/sh

set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

fail() {
  echo "FAIL $1"
  exit 1
}

[ "$(git branch --show-current)" = "main" ] || fail "CURRENT_BRANCH_IS_NOT_MAIN"
[ -z "$(git status --porcelain)" ] || fail "WORKTREE_NOT_CLEAN"

sh scripts/verify-workflows.sh || fail "WORKFLOW_VERIFICATION"

if [ -n "$(git ls-files '.private/**' '*.raw.json')" ]; then
  fail "PRIVATE_EXPORT_TRACKED"
fi

if git grep -I -n -E '(Bearer[[:space:]]+[A-Za-z0-9._/+:-]{8,}|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|channel[_ -]?access[_ -]?token[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,})' HEAD -- >/dev/null; then
  fail "POSSIBLE_SECRET_IN_TRACKED_CONTENT"
fi

git fetch --quiet origin main || fail "FETCH_OR_AUTHENTICATION"

counts=$(git rev-list --left-right --count HEAD...origin/main)
ahead=$(printf '%s' "$counts" | awk '{print $1}')
behind=$(printf '%s' "$counts" | awk '{print $2}')

[ "$behind" -eq 0 ] || fail "REMOTE_AHEAD_OR_HISTORY_DIVERGED"

if [ "$ahead" -eq 0 ]; then
  echo "PASS NOTHING_TO_PUSH"
  exit 0
fi

git merge-base --is-ancestor origin/main HEAD || fail "NON_FAST_FORWARD_HISTORY"
git push origin main || fail "PUSH_OR_AUTHENTICATION"
git fetch --quiet origin main || fail "POST_PUSH_FETCH"

[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "REMOTE_HEAD_MISMATCH"

echo "PASS REMOTE_UPDATED $(git rev-parse --short HEAD)"
