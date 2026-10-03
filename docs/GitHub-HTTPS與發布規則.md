# GitHub HTTPS 與正式發布規則

更新日期：2026-10-03（Asia/Taipei）

## 一、治理原則

本專案正式採用：**本機 Git 是唯一提交來源**。

- 所有正式提交只在本機建立。
- GitHub 網頁只用於檢視提交、檔案與驗證結果。
- 已在本機提交的內容，不得再用 GitHub `Upload files` 或網頁編輯器重複提交。
- `git push` 失敗時立即停止；先修復認證或同步問題，不改走網頁提交。
- n8n 線上修改、Git 本機提交、GitHub 推送與實際執行證據必須分開記錄。

## 二、固定發布順序

```text
n8n 修改與匯出
→ 公開檔案去敏
→ 建立並執行功能驗證
→ 全部 PASS
→ git fetch origin main
→ 確認 origin/main 未領先本機
→ 僅加入本次核准的檔案
→ 本機 commit
→ 執行 scripts/publish-verified.sh
→ push origin main
→ fetch 並確認 HEAD == origin/main
```

## 三、硬性閘門

符合下列任一條件時，禁止建立完成標記或推送：

1. 功能驗證出現任何 `FAIL`。
2. 公開 workflow JSON 無法解析。
3. 發現 credential 參照、明文 token、Webhook path、資源 ID 或敏感測試內容。
4. `.private/` 或原始 workflow 匯出檔受到 Git 追蹤。
5. 目前分支不是 `main`。
6. 工作樹或暫存區仍有未提交變更。
7. `origin/main` 領先本機，或本機與遠端已分岔。
8. GitHub HTTPS 認證失敗。
9. 推送後 `HEAD` 與 `origin/main` 不一致。

## 四、防呆機制

### 正式發布指令

```bash
sh scripts/publish-verified.sh
```

該程式會依序執行：

- M0 workflow 驗證；
- Git 工作樹、分支與遠端關係檢查；
- 已追蹤內容的敏感字串與私有檔案檢查；
- `git fetch origin main`；
- 僅在本機為遠端的快轉後代時執行 `git push origin main`；
- 推送後重新抓取並核對遠端提交。

### 第二層保護

專案使用 `.githooks/pre-push`。即使直接執行 `git push`，仍會再次執行驗證並拒絕：

- 非 `main` 推送至遠端 `main`；
- 非快轉更新；
- 工作樹不乾淨；
- workflow 驗證失敗。

啟用方式：

```bash
git config core.hooksPath .githooks
```

## 五、GitHub HTTPS 認證邊界

- 遠端固定使用 `https://github.com/07mar2026-code/Limitation06Apr26-n8n.git`。
- 使用 GitHub 官方登入流程與 macOS Keychain 保存認證。
- 不把 Personal Access Token 寫入 remote URL、檔案、終端紀錄或 Git。
- 不要求任何人把 token 貼到聊天中。
- GitHub 網頁登入與本機 Git HTTPS 登入是兩套不同的登入狀態。

## 六、異常處理

### Push 認證失敗

停止發布，重新完成 GitHub CLI／Credential Manager 的官方登入；禁止改用 GitHub 網頁重建相同提交。

### 遠端領先或歷史分岔

停止發布，先建立備份分支、抓取遠端並判定差異。未確認內容與恢復點前，不得 reset、rebase、merge 或強制推送。

### 沒有新提交

發布程式回報 `NOTHING_TO_PUSH` 並正常停止，不製造空提交。
