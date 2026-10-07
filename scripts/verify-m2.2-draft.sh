#!/bin/sh

set -eu

contract="drafts/m2.2-data-isolation.contract.json"
workflow="workflows/daily-shepherd.sanitized.json"

jq -e . "$contract" >/dev/null
echo "PASS M2_2_DRAFT_JSON_VALID"

jq -e '
  .status == "draft_only_not_published"
  and .identity.algorithm == "HMAC-SHA256"
  and .identity.encoding == "base64url"
  and .identity.secretReference == "PASTORAL_ID_HMAC_KEY"
  and .identity.persistRawLineUserId == false
  and .consent.default == false
  and .consent.requiredBeforeWrite == true
  and .consent.requiredBeforeHistoryRead == true
  and .storage.legacyMigration == "none"
  and .storage.retentionDays == 30
  and .historyRead.serverSideIdentityFilterRequired == true
  and .historyRead.maxItems == 10
  and .contextGuard.verifyEveryItemIdentity == true
  and .contextGuard.onIdentityMismatch == "block_and_safe_fallback"
  and .contextGuard.exposeInternalIdentifierToModel == false
  and .liveWorkflow.d4MustRemainDisabled == true
  and .liveWorkflow.publishAllowed == false
  and .liveWorkflow.realUserTestAllowed == false
' "$contract" >/dev/null
echo "PASS M2_2_DRAFT_SECURITY_CONTRACT"

jq -e '
  ([.nodes[] | select(.name == "D4. 讀取歷史對話紀錄" and .disabled == true)] | length == 1)
' "$workflow" >/dev/null
echo "PASS M2_2_LIVE_D4_STILL_DISABLED"

if rg -n -i '(Bearer[[:space:]]+[A-Za-z0-9._/+:-]{8,}|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|U[0-9a-f]{32}|docs\.google\.com/spreadsheets/d/)' "$contract" docs/M2.2-A資料隔離設計與安全草稿.md >/dev/null; then
  echo "FAIL M2_2_DRAFT_SENSITIVE_CONTENT"
  exit 1
fi
echo "PASS M2_2_DRAFT_NO_SENSITIVE_CONTENT"
