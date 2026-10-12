# M2.2-C 續作包

更新時間：2026-10-12 21:26（Asia/Taipei）

用途：集中保存 `M2.2-C 提示詞優化與經文正確性驗證` 的現行規則、最新進度、模組規格、測試證據與後續正式案例。新對話應先讀本頁，再依序讀取 `01` 至 `04`。

## 一、閱讀順序

1. [01-M2.2-C-續作主包.md](./01-M2.2-C-續作主包.md)：目前狀態、共同安全閘門與接續邊界。
2. [02-M2.2-C-經文與屬靈文章來源規格.md](./02-M2.2-C-經文與屬靈文章來源規格.md)：經文、屬靈文章、教會隔離與來源替換規格。
3. [03-M2.2-C-測試與驗收紀錄.md](./03-M2.2-C-測試與驗收紀錄.md)：C1～C4、來源模組及 execution 證據。
4. [04-M2.2-C-後續正式案例.md](./04-M2.2-C-後續正式案例.md)：30 天／10 筆、錯誤 ID、compact、續期與撤回／刪除案例。

## 二、目前一句話狀態

`M2.2-C4` 與第五、六階段合成案例均已在未發布獨立 workflow 通過；無寫入記憶體韌性壓測的 10／25／50 筆與 25 筆、併發 2 已於 execution `#594` 通過。有限 Google Sheet 寫入壓測 JSON 已產生，但因瀏覽器上傳權限未授予而停在匯入前，沒有 Sheet 寫入或刪除。最新有效資料仍為保存同意 2、歷史對話 2；正式 `Daily Shepherd` 維持 Published、正式 D4 維持 Deactivated，所有新增驗證 workflow 皆未發布，本輪未發布正式功能、未 push。

## 三、新舊文件對照

| 舊文件或舊段落 | 新位置 | 處理方式 |
|---|---|---|
| `docs/M2.2正式版續作包.md` 內的 M2.2-C 段落 | `01`、`03`、`04` | 保留舊檔；新包採最新狀態，不讓舊 FAIL 覆蓋新證據 |
| `docs/M2.2-C可替換屬靈文章來源模組.md` | `02` | 規格整併並更新 n8n 接入狀態 |
| `docs/M2.2-C屬靈文章來源模組測試報告.md` | `03` | 本機 10 項與 n8n execution 證據合併 |
| `docs/M2.2正式同意與30天精華設計.md` | `04` | 只抽取 C 後續正式案例與不可跨越界線 |

舊檔目前不刪除、不搬移、不改名；待日後另行決定名稱遷移與去重方式。

## 四、程式與測試資產

程式碼維持單一來源，不複製到 `docs`：

- `drafts/m2.2-c-spiritual-source.contract.json`
- `drafts/m2.2-c-spiritual-source-engine.mjs`
- `drafts/m2.2-c-spiritual-source-fixtures.json`
- `scripts/test-m2.2-c-spiritual-source.mjs`

上述資產目前仍保存在既有安全 checkpoint；若要納入正式 Git 版本，必須先確認檔案歸屬、去敏與工作樹範圍，不得連同 `node_modules`、輸出圖片、試算表或其他無關檔案一起提交。

本輪壓測另有兩組私人準備資產，均位於 `.private/`、不在 Git 工作樹清單內，也不等於正式文件：

- `.private/build-m2.2-stress.mjs`
- `.private/M2.2-C-記憶體韌性壓測-修正版-未發布.json`
- `.private/build-m2.2-sheet-stress.mjs`
- `.private/M2.2-C-Sheet有限寫入壓測-未發布.json`

## 六、本輪最新結果（2026-10-12）

有限 Google Sheet 寫入壓測已解除 BLOCKED 並完成 execution `#600`：10 筆與 25 筆固定合成 fixture 均完成精確寫入、回讀、清理及 `0／0` 驗收；最終 Google Sheet 畫面回讀為保存同意 2、歷史對話 2。workflow `2HS1TfYxR6Sc1VFA` 維持未發布，未執行 LINE、模型或 production webhook。本輪只更新續作包，未 Publish、未 commit、未 push。

## 五、狀態用語

- `PASS`：已有本輪可回讀的執行證據。
- `PASS／未發布`：測試通過，但只存在未發布副本或獨立測試鏈。
- `FAIL`：執行結果不符合條件；保留作歷史證據。
- `未確認`：舊證據可能過期，或缺少當前精確回讀。
- `未執行`：尚未實際執行案例。

未發布副本、本機模組或合成測試通過，不等於 M2.2 正式歷史記憶、屬靈文章模組或正式 LINE Bot 已上線。
