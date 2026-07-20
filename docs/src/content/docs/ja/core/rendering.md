---
title: レンダリングモデル
description: 各出力形式の生成元と Chromium を使用する PDF 出力の境界
---

すべての出力は、`mdi-core` が解析した同じ文書 IR を基に生成する。出力形式ごとに MDI ソースを再解析することはない。

## HTML とテキスト

HTML、プレーンテキスト、ルビ保持テキスト、投稿サイト向けテキストは Rust コアが直接生成する。HTML は MDI 用のクラスとスタイルを含む。

## EPUB と DOCX

EPUB 3 と DOCX も Rust コアが生成する。front matter のメタデータを利用するが、カバー、章分割、ページ設定、フォントなど、エクスポートプロファイルの一部設定は未対応である。

## PDF と Chromium の境界

PDF は次の手順で生成する。

```text
.mdi ソース → mdi-core → HTML / 印刷用 CSS → Chromium → PDF
```

Chromium の役割は HTML と CSS のページレイアウトおよび PDF 化のみである。Chromium に `.mdi` ソースを渡したり、MDI の構文判断を任せたりすることはない。

そのため、PDF 出力には Chromium を起動できる Node.js ホスト、CLI、またはネイティブ環境が必要である。ブラウザ上の WebAssembly だけでは PDF を生成できない。

## 次のステップ

- [出力形式](/ja/ecosystem/outputs/) — 形式ごとの用途を確認する。
- [エクスポートプロファイル](/ja/ecosystem/export-profiles/) — PDF とテキストの設定を指定する。
