# M2.2-C P0–P9 正式發布續作包

續作包識別名稱：`M2.2-C-RELEASE-P0-P9-20261012`

建立日期：2026-10-12（Asia/Taipei）

## 用途

本包保存 M2.2-C 從正式流程最小整合到真實使用者發布判定的 P0–P9 執行邊界、階段識別名稱、驗收欄位與後續修改空間。

本包是新增規劃包，不取代或改寫既有 [M2.2-C 續作包](../M2.2-C續作包/README.md) 的歷史證據。

## 目前狀態

- P0–P4：已完成即時回讀與驗收；P0、P1、P2、P3、P4 均 PASS，但僅限合成／未發布範圍。
- P5：已完成匿名 LINE 端到端驗證，execution `#602` 成功並收到一則預期回覆；Zeabur 短暫控制台網路異常已恢復，補回讀 n8n／task-runner 均為 1／1，兩者均有 `PASTORAL_ID_HMAC_KEY` 名稱，P5 整體 PASS。
- P6：PASS。未發布候選 workflow `wwgD8u7tBK4oCP6b` 的 D4 已處於 Active；候選仍未 Publish，正式 `Daily Shepherd` 維持 Published，正式 D4 維持 Deactivated。
- P7：PASS。候選 D4 Active 已完成 fallback、同意寫入／撤回清理、正常 D4 路徑與 3 回合固定合成壓測；最新 execution `#617` 成功，Google Sheet 最終回到保存同意 2、歷史對話 2。
- P8–P9：尚未執行。
- HMAC runtime 追加證據：未發布、無副作用候選 workflow execution `#622` Succeeded，`missingHmacKey=false`；未讀取或記錄金鑰值。
- M2.2-C 有限 Google Sheet 合成壓測：已完成，execution `#600`。
- 既有 M2.2-C 文件 checkpoint：`e2d7ad9`，已 push 至 `origin/main`。
- 正式 `Daily Shepherd`：維持 Published。
- 正式 D4：目前維持 Deactivated。
- 本包要求：D4 必須在正式完成前於受控正式候選版本啟用並完成驗證；在 P9 決定前不得將未驗證版本提供給真實使用者。

## 使用規則

1. 依 `01-P0-P9-執行計劃.md` 順序執行。
2. 每階段使用 `02-P0-P9-驗收紀錄模板.md` 留下輸入、預期、實際、結果、時間及資料影響。
3. 任一 FAIL、狀態不明、資料跨 ID、非預期 LINE／模型／webhook、清理失敗或憑證異常，立即停止。
4. 後續修改只新增「變更紀錄」與新驗收列，不刪除或改寫已完成證據。
5. P9 前不 Publish；commit、push 與正式 Publish 分開判定。

## 文件結構

- `01-P0-P9-執行計劃.md`：階段順序、唯一識別名稱、依賴與停止條件。
- `02-P0-P9-驗收紀錄模板.md`：逐階段驗收表與變更紀錄。
- `03-P0-P4-實際執行紀錄.md`：本輪 P0–P4 的即時回讀、execution、Sheet 與安全邊界證據。
- `04-P5-實際執行紀錄.md`：P5 匿名 LINE 端到端 execution、LINE／Sheet／服務閘門回讀與 PASS 證據。
- `05-P6-實際執行紀錄.md`：P6 候選 D4 受控啟用狀態回讀與 PASS 證據。
- `07-P7-實際執行紀錄.md`：P7 候選 D4 Active 案例、清理與壓測回讀證據。
- `08-HMAC真正原因與正確驗證基準.md`：釐清歷史阻塞、Zeabur 介面與 runtime 證據的差異，避免重複要求恢復金鑰。
- `06-新對話續作提示詞.md`：接續 P7–P9 時可直接貼到新對話框的提示詞。

## 變更紀錄

| 日期 | 變更 | 影響 |
|---|---|---|
| 2026-10-13 | 將舊版 HMAC 阻塞標示為歷史快照；新增正確驗證基準與防重複誤判規則 | 僅修正文件判定與接續依據；未修改 n8n、正式 D4、Google Sheet 或 Publish |
| 2026-10-13 | 執行無副作用候選 runtime probe `#622` 並回讀 `missingHmacKey=false` | 補強 HMAC 執行期證據；未修改正式流程、未 Publish、未寫入 Sheet／LINE |
