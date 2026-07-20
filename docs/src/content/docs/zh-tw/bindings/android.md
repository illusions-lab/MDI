---
title: Android / Kotlin
description: Android JNI 綁定的架構、目前契約與本機驗證方式。
---

Android 綁定是以 AAR 形式提供的 Kotlin 介面，底下只有一層精簡的 JNI façade。它把完整的 UTF-8 原始碼直接交給 `mdi-core`；Android 程式碼不會自行切分 Markdown 或 MDI、修補分隔符號的退回行為，也不負責渲染文件語意。

## 契約

- `minSdk` 為 23，library 以 API 36 編譯；使用它的 app 自行決定 target SDK（目前送交 Google Play 應使用 API 36）。
- 裝置提供 `arm64-v8a`，emulator 提供 `x86_64`；Android v1 刻意不支援 32-bit ARM。
- `parse`、HTML、canonical MDI serialization、TXT、EPUB 與 DOCX 都委派給 Rust。EPUB 與 DOCX 回傳 `ByteArray`，app 應透過 Storage Access Framework 寫入這些位元組。
- 解析結果會拒絕不支援的 IR 版本，並保留 diagnostics 與 UTF-8 byte spans。
- Kotlin unit coverage 設有強制的 90% 行覆蓋率門檻；驗收命令會先產生 JaCoCo XML、HTML 報告，再執行裝置測試。
- PDF 不是 Android API。Rust 的 PDF 路徑需要可執行的 Chromium process；Android app 應在 WebView 顯示 Rust HTML，或改用 Android 的 print framework。

```kotlin
val result = Mdi.parse("{東京|とうきょう}で第^12^話を読む。")
val html = Mdi.renderHtml("# 題\n\n{東京|とうきょう}")
```

本機 Rust target 設定、native library 產生與驗收命令，請見 [`android/README.md`](https://github.com/illusions-lab/MDI/blob/main/android/README.md)。
