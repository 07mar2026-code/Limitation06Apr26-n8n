# n8n 線上修改安全規則

更新日期：2026-10-04（Asia/Taipei）

## 一、核心原則

> **Online 是正式寫入的前置條件；Offline 僅允許唯讀檢查。**

「Online」代表目前 n8n 編輯器已與後端恢復正常連線，而且修改可以保存並回讀確認。只看到工作流為 `Published`，不能取代 Online、保存成功或端到端驗證證據。

## 二、允許與禁止事項

| 編輯器狀態 | 允許 | 禁止 |
|---|---|---|
| Online，且可保存與回讀 | 正式修改、逐點保存確認、Credential 遷移、發布與驗證 | 未確認保存即批次修改 |
| Offline、Reconnecting 或連線狀態不明 | 查看畫面、記錄節點名稱與現況、比對既有文件、規劃待辦 | 正式修改、刪除、Credential／Authorization 遷移、Publish、以畫面狀態宣告完成 |

Offline 時不得以「稍後可能自動同步」作為繼續寫入的依據，也不得把尚未回讀確認的畫面變化當成已保存版本。

## 三、標準作業程序（SOP）

```text
確認 Online 且可保存／回讀
→ 只修改一個最小單位
→ 逐一確認關鍵節點已保存
→ 批次套用相同變更
→ 抽查全部目標與舊設定是否清除
→ Publish
→ 端到端驗證
→ 匯出、去敏與執行專案驗證閘門
→ 驗證 PASS 後才可 Git commit／push
```

### 執行檢核

1. **寫入前**
   - 確認畫面不顯示 Offline／Reconnecting。
   - 用低風險方式確認工作流能保存，並重新開啟或回讀剛才的狀態。
   - 記錄本次修改範圍、預期結果與最近一次已知成功保存點。
2. **最小修改**
   - 先選一個代表性節點完成修改。
   - 關閉並重新開啟該節點，確認參數、Credential 綁定與已刪除欄位仍符合預期。
3. **批次套用**
   - 只有代表性節點保存確認成功後，才套用到其餘目標節點。
   - 每個關鍵節點都要逐一核對，不以畫布外觀推定內部設定已保存。
4. **發布與驗證**
   - 確認所有目標節點保存後才 Publish。
   - 依功能驗證閘門記錄：功能、輸入、預期、實際、PASS／FAIL、時間。
   - Publish 只代表正式版本已發布，不等於 LINE 已送達或資料已正確寫入；仍須端到端證據。
5. **Git 邊界**
   - 匯出最新 workflow，只把去敏版本放入 Git。
   - 執行 `sh scripts/verify-workflows.sh` 與 `git diff --check`。
   - 只有功能與資安驗證全部 PASS，才能建立 commit；正式推送仍須通過 `scripts/publish-verified.sh`。

## 四、中途轉為 Offline 的復原程序

若修改途中出現 Offline、Reconnecting、保存失敗或連線狀態不明：

1. 立即停止所有後續寫入、刪除、批次修改與 Publish。
2. 記錄正在處理的節點、最後一次已確認保存的節點，以及尚未確認的變更。
3. 重新連線；未恢復前只做唯讀檢查。
4. 恢復 Online 後，從「最近一次成功保存點」開始回讀，而不是從畫面暫存狀態接續。
5. 逐一核對最近修改過的節點，將結果分成：已保存、未保存、狀態不明。
6. 對未保存或狀態不明項目重新執行最小修改與保存確認。
7. 全部狀態重新建立後，才可繼續批次套用、Publish 與端到端驗證。

## 五、Credential／Authorization 防半套狀態規則

Credential 或 Authorization 變更必須視為不可拆散的安全交易，避免「舊授權已刪除，但新 Credential 未保存」或「新 Credential 已掛載，但舊明文仍殘留」。

固定順序如下：

1. 唯讀盤點所有目標節點與既有授權方式；不得讀取、複製、顯示或記錄明文 token。
2. 確認可重用的命名 Credential 已存在，且編輯器保持 Online。
3. 先在一個代表性節點掛載 Credential；保存並回讀確認。
4. 確認新 Credential 綁定存在後，才移除該節點的舊 Authorization Header；再次保存並回讀。
5. 對代表性節點執行非破壞性或受控測試並取得 PASS，才可批次處理其他節點。
6. 批次完成後逐一確認：目標 Credential 已綁定、舊明文 Authorization 已清除、非敏感必要 Header 仍保留。
7. 重新 Publish 並執行端到端測試；若任何一步 FAIL，停止提交與推送。
8. 公開匯出不得包含 credential 參照、明文 token、個資或敏感測試內容；原始匯出只可留在 `.private/`。

若任一步驟中途轉為 Offline，該節點一律標為「狀態不明」，不得假設已完成；恢復後必須同時重查新 Credential 與舊 Authorization，確認沒有半套狀態。

## 六、完成判定

只有同時具備以下證據，才能把本輪 n8n 修改標示為完成：

- 修改期間處於 Online，且關鍵節點已保存並回讀。
- Publish 完成。
- 功能端到端驗證 PASS。
- Credential／Authorization 檢查 PASS，未留下半套狀態。
- 最新 workflow 已匯出、去敏並通過專案驗證。
- Git 提交與推送符合 [GitHub HTTPS 與正式發布規則](./GitHub-HTTPS與發布規則.md)。
