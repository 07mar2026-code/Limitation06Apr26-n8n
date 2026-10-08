#!/bin/sh

set -eu

contract="drafts/m2.2-data-isolation.contract.json"
workflow="workflows/daily-shepherd.sanitized.json"
test_workflow="drafts/m2.2-isolation-test-workflow.json"
engine="drafts/m2.2-isolation-engine.mjs"
node_bin=${NODE_BIN:-node}

if ! command -v "$node_bin" >/dev/null 2>&1; then
  bundled_node="/Users/micro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  [ -x "$bundled_node" ] || {
    echo "FAIL M2_2_NODE_RUNTIME_NOT_FOUND"
    exit 1
  }
  node_bin="$bundled_node"
fi

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

jq -e . "$test_workflow" >/dev/null
echo "PASS M2_2_TEST_WORKFLOW_JSON_VALID"

jq -e '
  .name == "M2.2 資料隔離合成測試（草稿）"
  and .active == false
  and .meta.draftOnly == true
  and .meta.productionWebhookConnected == false
  and ([.nodes[] | select(.type | test("webhook"; "i"))] | length == 0)
  and ([.nodes[] | select(.parameters.jsCode? | strings | contains("PASTORAL_ID_HMAC_KEY"))] | length == 1)
' "$test_workflow" >/dev/null
echo "PASS M2_2_TEST_WORKFLOW_ISOLATED_UNPUBLISHED"

if rg -n "process\.env\.PASTORAL_ID_HMAC_KEY" "$engine" >/dev/null \
  && ! rg -n "process\.env\.[A-Za-z0-9_]+" "$engine" | rg -v "PASTORAL_ID_HMAC_KEY" >/dev/null; then
  echo "PASS M2_2_HMAC_SECRET_REFERENCE_ONLY"
else
  echo "FAIL M2_2_HMAC_SECRET_REFERENCE_ONLY"
  exit 1
fi

"$node_bin" scripts/test-m2.2-isolation.mjs >/dev/null
echo "PASS M2_2_SYNTHETIC_ISOLATION_TESTS"

jq -e '
  ([.nodes[] | select(.name == "D4. 讀取歷史對話紀錄" and .disabled == true)] | length == 1)
' "$workflow" >/dev/null
echo "PASS M2_2_LIVE_D4_STILL_DISABLED"

if rg -n -i '(Bearer[[:space:]]+[A-Za-z0-9._/+:-]{8,}|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|U[0-9a-f]{32}|docs\.google\.com/spreadsheets/d/)' "$contract" "$test_workflow" "$engine" scripts/test-m2.2-isolation.mjs docs/M2.2-A資料隔離設計與安全草稿.md >/dev/null; then
  echo "FAIL M2_2_DRAFT_SENSITIVE_CONTENT"
  exit 1
fi
echo "PASS M2_2_DRAFT_NO_SENSITIVE_CONTENT"
