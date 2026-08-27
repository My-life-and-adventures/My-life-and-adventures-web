#!/usr/bin/env bash
#
# Pull, build, and restart the web app — run every 5 minutes by
# mylife-web-deploy.timer.
#
# The service is only restarted when the remote branch has actually moved.
# Restarting on every tick would bounce the site 288 times a day and drop live
# connections each time, to redeploy bytes that did not change. Set
# ALWAYS_RESTART=1 to get the unconditional behaviour anyway.
#
# A failed build never reaches the restart: `set -e` stops here, systemd marks
# the run failed, and the currently-serving build stays up. Shipping a broken
# build is worse than being a few minutes behind.

set -euo pipefail

APP_DIR=${APP_DIR:-/srv/mylife-web}
BRANCH=${BRANCH:-main}
SERVICE=${SERVICE:-mylife-web}
ALWAYS_RESTART=${ALWAYS_RESTART:-0}

cd "$APP_DIR"

git fetch --quiet origin "$BRANCH"

before=$(git rev-parse HEAD)
remote=$(git rev-parse "origin/$BRANCH")

if [ "$before" = "$remote" ] && [ "$ALWAYS_RESTART" != "1" ]; then
  echo "Already at ${before:0:8} — nothing to deploy."
  exit 0
fi

# A deploy box should be a clean checkout. Fast-forwarding over local edits
# would either fail confusingly or silently discard whatever someone was
# mid-way through doing on the server.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree at $APP_DIR has uncommitted changes — refusing to deploy." >&2
  echo "Commit, stash, or 'git checkout -- .' on the server, then let the next tick run." >&2
  exit 1
fi

# --ff-only, never a merge: if the branches have diverged, someone committed on
# the server and that needs a human, not an automatic merge commit in production.
git merge --ff-only "origin/$BRANCH"
after=$(git rev-parse HEAD)
echo "Updated ${before:0:8} -> ${after:0:8}"

# Reinstall only when the manifest actually moved. `npm ci` wipes node_modules
# and refetches everything, which is far too slow to do every time something
# changes — but skipping it when a dependency changed builds against stale
# packages, which fails in ways that look like source bugs.
if ! git diff --quiet "$before" "$after" -- package.json package-lock.json; then
  echo "Dependencies changed — running npm ci"
  npm ci
fi

npm run build

systemctl restart "$SERVICE"

# A restart that fails leaves the site down, and the timer would otherwise
# report success and stay quiet about it until someone visited the site.
sleep 2
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "$SERVICE did not come back up after restart." >&2
  systemctl status "$SERVICE" --no-pager --lines=20 >&2 || true
  exit 1
fi

echo "Deployed ${after:0:8} and restarted $SERVICE."
