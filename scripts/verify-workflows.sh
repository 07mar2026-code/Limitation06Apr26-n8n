#!/bin/sh

set -eu

status=0
files="workflows/daily-shepherd.sanitized.json workflows/ocr-workflow.sanitized.json"

for file in $files; do
  if ! jq -e . "$file" >/dev/null; then
    echo "FAIL JSON_INVALID $file"
    status=1
    continue
  else
    echo "PASS JSON_VALID $file"
  fi

  if jq -e '.. | objects | select(has("credentials"))' "$file" >/dev/null; then
    echo "FAIL CREDENTIAL_REFERENCE $file"
    status=1
  else
    echo "PASS NO_CREDENTIAL_REFERENCE $file"
  fi

  if jq -e '.. | strings | select(test("(?i)(bearer\\s+[A-Za-z0-9._${}{}/:+-]{8,}|sk-[A-Za-z0-9_-]{8,}|channel[_ -]?access[_ -]?token)"))' "$file" >/dev/null; then
    echo "FAIL POSSIBLE_SECRET $file"
    status=1
  else
    echo "PASS NO_PLAINTEXT_SECRET $file"
  fi

  if jq -e '
    ([.. | objects | .cachedResultUrl? // empty | select(. != "[REDACTED_RESOURCE_URL]")] | length == 0)
    and ([.. | objects | .cachedResultName? // empty | select(. != "[REDACTED_RESOURCE_NAME]")] | length == 0)
    and ([.. | objects | to_entries[] | select(.key == "documentId" or .key == "sheetName" or .key == "folderNoRootId" or .key == "workflowId") | .value.value? // empty | select(startswith("[REDACTED_") | not)] | length == 0)
  ' "$file" >/dev/null; then
    echo "PASS PUBLIC_RESOURCE_IDENTIFIERS_REDACTED $file"
  else
    echo "FAIL PUBLIC_RESOURCE_IDENTIFIER_EXPOSED $file"
    status=1
  fi
done

duplicates=$(jq -rs '
  [.[].nodes[] | select(.type == "n8n-nodes-base.webhook") |
    {workflow: input_filename, name: .name, path: .parameters.path}]
  | group_by(.path)
  | map(select(length > 1))
  | .[]
  | map(.path)[0]
' $files)

if [ -n "$duplicates" ]; then
  echo "FAIL DUPLICATE_WEBHOOK_PATH"
  echo "$duplicates"
  status=1
else
  echo "PASS UNIQUE_WEBHOOK_PATHS"
fi

daily_file="workflows/daily-shepherd.sanitized.json"
ocr_file="workflows/ocr-workflow.sanitized.json"

if jq -e '
  [.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path] == ["[REDACTED_LINE_WEBHOOK_PATH]"]
' "$daily_file" >/dev/null \
&& jq -e '
  [.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path] == ["[REDACTED_OCR_WEBHOOK_PATH]"]
' "$ocr_file" >/dev/null; then
  echo "PASS PUBLIC_WEBHOOK_PATHS_REDACTED"
else
  echo "FAIL PUBLIC_WEBHOOK_PATH_EXPOSED"
  status=1
fi

internal_path=$(jq -r '
  [.nodes[] | select(.type == "n8n-nodes-base.webhook" and .name == "接收內部 OCR 請求") | .parameters.path]
  | if length == 1 then .[0] else "" end
' "$ocr_file")

call_url=$(jq -r '
  [.nodes[] | select(.name == "F1. 呼叫 OCR 辨識服務" and .type == "n8n-nodes-base.httpRequest") | .parameters.url]
  | if length == 1 then .[0] else "" end
' "$daily_file")

if [ -n "$internal_path" ] && [ "$call_url" = "https://20260419.zeabur.app/webhook/$internal_path" ]; then
  echo "PASS OCR_INTERNAL_WEBHOOK_TARGET"
else
  echo "FAIL OCR_INTERNAL_WEBHOOK_TARGET"
  status=1
fi

if jq -e '
  ([.nodes[] | select(.name == "接收內部 OCR 請求" and .parameters.responseMode == "responseNode")] | length == 1)
  and ([.nodes[] | select(.name == "回傳 OCR 辨識結果" and .type == "n8n-nodes-base.respondToWebhook")] | length == 1)
  and (.connections["A3. 整理圖片辨識結果"].main[0][0].node == "回傳 OCR 辨識結果")
  and (.connections["B3. 整理 PDF 辨識結果"].main[0][0].node == "回傳 OCR 辨識結果")
' "$ocr_file" >/dev/null; then
  echo "PASS OCR_RESPONSE_CHAIN"
else
  echo "FAIL OCR_RESPONSE_CHAIN"
  status=1
fi

if jq -e '
  ([.nodes[] | select(.name == "判斷 LINE 訊息類型") | .parameters.rules.values[] | select(.outputKey == "OCR")] | length == 1)
  and (.connections["判斷 LINE 訊息類型"].main[5][0].node == "F1. 呼叫 OCR 辨識服務")
  and (.connections["F1. 呼叫 OCR 辨識服務"].main[0][0].node == "F2. 回覆 LINE OCR 結果")
' "$daily_file" >/dev/null; then
  echo "PASS DAILY_OCR_CALL_CHAIN"
else
  echo "FAIL DAILY_OCR_CALL_CHAIN"
  status=1
fi

if jq -e '
  ([.nodes[].name] | length == 22)
  and ([.nodes[].name] | unique | length == 22)
  and ([.nodes[].name | select(. != "接收 LINE 事件" and . != "判斷 LINE 訊息類型") | test("^[A-F][0-9]+\\. ")] | all)
' "$daily_file" >/dev/null \
&& jq -e '
  ([.nodes[].name] | length == 28)
  and ([.nodes[].name] | unique | length == 28)
  and ([.nodes[].name | select(. != "接收內部 OCR 請求" and . != "判斷 OCR 檔案類型" and . != "回傳 OCR 辨識結果") | test("^[A-H][0-9]+\\. ")] | all)
' "$ocr_file" >/dev/null; then
  echo "PASS NODE_NAMING_SCHEME"
else
  echo "FAIL NODE_NAMING_SCHEME"
  status=1
fi

exit "$status"
