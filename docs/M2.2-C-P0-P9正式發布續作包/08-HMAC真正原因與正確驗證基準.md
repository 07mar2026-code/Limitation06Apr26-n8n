# HMAC 真正原因與正確驗證基準

更新時間：2026-10-13（Asia/Taipei）

## 結論

本輪重複要求恢復 `PASTORAL_ID_HMAC_KEY` 的真正原因，不是目前已再次證明金鑰遺失，而是把三種不同證據混在一起判定：

1. 舊文件中的歷史 `MISSING_HMAC_KEY` 阻塞狀態。
2. Zeabur 一般「使用者變數」清單顯示「尚無變數」的介面結果。
3. n8n／task-runner 重啟後的實際執行期布林證據。

第 1、2 項都不能單獨推論第 3 項為缺失。因此在已有後續成功 execution 的情況下再次要求使用者恢復金鑰，是驗證流程與文件狀態管理錯誤，並非新的安全證據。

## 可核對的現有證據

| 證據 | 正確解讀 |
|---|---|
| 舊檔 `M2.2正式版續作包.md` 的 `task-runner 變數名稱：缺少`、`MISSING_HMAC_KEY` | 2026-10-10 歷史快照；不得當作目前狀態 |
| `M2.2-C續作包/01-M2.2-C-續作主包.md` | 記錄 n8n 與 task-runner 均有名稱，且 execution `#594` 為 `missingHmacKey=false` |
| 同一主包的有限 Sheet 壓測 | 記錄兩服務重啟後均為 1／1，execution `#600` 為 `missingHmacKey=false` |
| P5 執行紀錄與驗收表 | 記錄 execution `#602` 後雙服務均為 1／1，名稱已回讀；金鑰值未讀取 |
| Zeabur「使用者變數」頁面顯示「尚無變數」 | 只代表該清單沒有可顯示的使用者變數；頁面另有「編輯原始環境變數」，不能據此判定原始環境變數缺失 |

## 技術根因

Code 節點實際由 task-runner 執行。只有 n8n 服務有變數名稱，不足以證明 task-runner 的執行環境可讀取相同秘密；早期 `MISSING_HMAC_KEY` 的合理根因是兩服務環境不同步。後續雙服務重啟與成功 execution 已提供較高層級的 runtime 證據，故不能在沒有新的 runtime 失敗時重複要求恢復。

## 正確的單一驗證基準

每次只記錄以下去敏欄位，不讀取、不顯示、不寫入金鑰值：

1. n8n 原始環境變數名稱：`PASTORAL_ID_HMAC_KEY` 存在／未確認。
2. task-runner 原始環境變數名稱：`PASTORAL_ID_HMAC_KEY` 存在／未確認。
3. n8n 與 task-runner 重啟後狀態：均為 `運作中 1/1`／未確認。
4. 候選 workflow 的安全執行結果：`missingHmacKey=false`／`MISSING_HMAC_KEY`／未確認。
5. 證據時間、workflow／execution ID，以及是否觸發 LINE、模型或 Sheet 寫入。

只有第 4 項在新的安全候選執行中回報 `MISSING_HMAC_KEY`，且第 1–3 項已重新確認後，才可討論恢復金鑰。否則不得要求使用者再次恢復。

## 本次 runtime 證據（2026-10-13）

| 欄位 | 去敏結果 |
|---|---|
| workflow | `M2.2-C 記憶體韌性壓測（修正版，未發布）`；未發布 |
| execution | `#622`；2026-10-13 21:56:24；Succeeded；1.757 秒 |
| 執行範圍 | 手動啟動 → P1 安全閘門與合成識別 → P2／P3 → P4 最終驗收 |
| HMAC runtime 結果 | `missingHmacKey=false`；未出現 `MISSING_HMAC_KEY` |
| 外部副作用 | `sheetWrites=0`、`lineSends=0`、`modelExecutions=0`；未觸發正式 webhook |
| 金鑰處理 | 只驗證布林結果；未讀取、顯示或記錄金鑰值 |

本次先前誤入候選正式功能 workflow 的「等待測試 webhook」模式，已立即停止等待；沒有收到 webhook、沒有產生 execution，也沒有造成 LINE、模型或 Sheet 影響。該操作不列為 runtime 證據；本節只採用無副作用候選 workflow 的 `#622`。

## 防止重複誤判的文件規則

- 歷史阻塞必須標示「歷史快照」，不得放在目前狀態表而沒有日期與替代證據。
- Zeabur UI 清單與原始環境變數不可混稱；介面顯示「尚無變數」時只能記為「該清單未顯示」，不能記為「服務缺少金鑰」。
- `missingHmacKey=false` 是執行期證據；它不能被較舊的靜態文件覆蓋。
- 文件更新、Git commit／push、n8n Publish、正式 D4 啟用、LINE／Sheet 寫入仍分開記錄。
- 本文件不保存秘密值，只保存名稱、布林結果、時間與證據位置。

## 本次修正範圍

- 將舊版 M2.2 文件的 HMAC 表格標為歷史快照。
- 新增本文件作為目前 HMAC 判定基準。
- 尚未讀取或修改任何金鑰值。
- 尚未修改正式 `Daily Shepherd`、正式 D4、候選 workflow、Google Sheet 或 Publish 狀態。
- P8 尚未因此被改判 PASS；P9 仍須依原規則完成。
- 本次新增 runtime 證據 `#622` 只確認 HMAC 執行期可用，不改判 P8 或 P9。
