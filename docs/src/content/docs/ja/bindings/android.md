---
title: Android / Kotlin
description: Android JNI バインディングの構成、現在の契約、ローカルでの検証方法。
---

Android バインディングは、小さな JNI ファサードの上に構築した AAR 形式の Kotlin API です。完全な UTF-8 のソースをそのまま `mdi-core` に渡します。Android 側で Markdown/MDI をトークン化したり、区切り記号のフォールバックを補正したり、文書の意味をレンダリングしたりすることはありません。

## 契約

- `minSdk` は 23、ライブラリは API 36 に対してコンパイルします。利用側アプリの target SDK は利用側が管理します（現在の Google Play 提出では API 36）。
- 実機用に `arm64-v8a`、エミュレータ用に `x86_64` を提供します。Android v1 では意図的に 32-bit ARM を含めません。
- `parse`、HTML、canonical MDI serialization、TXT、EPUB、DOCX は Rust に委譲します。EPUB と DOCX は `ByteArray` を返すため、アプリは Storage Access Framework などでそのバイト列を書き出します。
- 解析結果は未対応の IR バージョンを拒否し、diagnostic と UTF-8 byte span を保持します。
- Kotlin unit coverage には line 90% の強制閾値があります。acceptance command は端末テストの前に JaCoCo の XML/HTML レポートを生成します。
- PDF は Android API にはありません。Rust の PDF 経路は実行可能な Chromium プロセスを必要とするため、Android アプリでは Rust HTML を WebView に表示するか、Android の印刷フレームワークを使用してください。

```kotlin
val result = Mdi.parse("{東京|とうきょう}で第^12^話を読む。")
val html = Mdi.renderHtml("# 題\n\n{東京|とうきょう}")
```

ローカルの Rust target の準備、native library の生成、acceptance command は [`android/README.md`](https://github.com/illusions-lab/MDI/blob/main/android/README.md) を参照してください。
