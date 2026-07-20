---
title: Python
description: PyO3 による Python バインディング
---

`illusion-markdown` は、PyO3 / maturin を利用して `mdi-core` を呼び出す Python パッケージである。Python 側に独自の MDI パーサーはない。

## インストール

```bash
pip install illusion-markdown
```

配布名は `illusion-markdown`、import 名は `mdi` である。Python 3.10 以降に対応する。macOS、Linux x64、Windows x64 向けの wheel を提供し、それ以外の環境では Rust ツールチェーンを必要とするソース配布版が使用される場合がある。

## 基本例

```python
import mdi

source = "# {東京|とうきょう}の夜\n\n第^12^話\n"
result = mdi.parse(source)

print(result["document"]["children"][0]["type"])
open("book.html", "w", encoding="utf-8").write(mdi.render_html(source))
```

## API

```python
mdi.parse(source: str) -> dict
mdi.render_html(source: str) -> str
mdi.render_text(source: str) -> str
mdi.render_text_format(source: str, format, indent_prefix: str = "") -> str
mdi.render_epub(source: str) -> bytes
mdi.render_docx(source: str) -> bytes
mdi.serialize_mdi(source: str) -> str
```

`parse()` は camelCase のキーを持つ辞書として文書 IR を返す。`MDI_SPEC_VERSION`、`MDI_IR_VERSION`、`TextFormat`、`MdiRenderError` も公開する。`parse_mdi_syntax` は互換性のために残されている非推奨 API である。

文字列以外の入力は `TypeError`、未知のテキスト形式は `ValueError`、EPUB / DOCX の生成に失敗した場合は `mdi.MdiRenderError` となる。通常の構文上の問題は例外ではなく、診断またはリテラルテキストとして扱われる。

## 制限事項

PDF レンダラーは Python API から公開していない。EPUB と DOCX は基本出力に対応するが、エクスポートプロファイルの全項目には未対応である。ソース位置は UTF-8 のバイトオフセットである。

## 次のステップ

- [ドキュメント IR](/ja/core/document-ir/) — 解析結果の構造を確認する。
- [出力形式](/ja/ecosystem/outputs/) — 各形式の違いを確認する。
