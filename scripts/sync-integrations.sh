#!/usr/bin/env bash
# Run on an existing Linux host, not inside the public repo with a secret.
set -euo pipefail
: "${EMS_BASE_URL:?Set EMS_BASE_URL (HTTPS production URL)}"
: "${CRON_SECRET:?Set CRON_SECRET in your protected environment}"
[[ "$EMS_BASE_URL" == https://* ]] || { echo "HTTPS required" >&2; exit 1; }
exec 9>"${EMS_SYNC_LOCK:-/tmp/dreamshift-ems-sync.lock}"
flock -n 9 || exit 0
failed=0
for path in google-calendar google-tasks device-push; do
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$path"
  # Supply credentials through stdin configuration rather than command-line arguments.
  if ! printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" | curl --config - --silent --show-error --fail-with-body --max-time 320 --request GET "${EMS_BASE_URL%/}/api/cron/$path"; then failed=1; fi
  printf '\n'
done
exit "$failed"
