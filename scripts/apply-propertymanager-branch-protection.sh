#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-SimeonBerwick/propertymanager}"
BRANCH="${2:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required." >&2
  exit 1
fi

gh auth status >/dev/null

tmp_json="$(mktemp)"
cat >"$tmp_json" <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["db-backed-test", "hosted-regression"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input "$tmp_json"

rm -f "$tmp_json"
echo "Applied branch protection to ${REPO}:${BRANCH}"
