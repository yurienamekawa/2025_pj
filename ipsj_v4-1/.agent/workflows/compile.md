---
description: vol1.texをコンパイルしてvol1.pdfを生成する
---

# vol1.texのコンパイル手順

このワークフローは、`vol1.tex`をPDFにコンパイルするための手順です。

## 手順

// turbo-all

1. UTF8ディレクトリに移動
```bash
cd /Users/yurienamekawa/Desktop/ipsj_v4-1/UTF8
```

2. 1回目のplatexコンパイル（相互参照の解決のため）
```bash
platex vol1.tex
```

3. 2回目のplatexコンパイル（相互参照を確定）
```bash
platex vol1.tex
```

4. DVIファイルをPDFに変換
```bash
dvipdfmx vol1.dvi
```

5. 生成されたPDFを確認
```bash
open vol1.pdf
```

## 注意事項

- 参考文献を使用する場合は、`pbibtex`も実行する必要があります
- エラーが出た場合は、ログファイル（`vol1.log`）を確認してください
- 中間ファイル（`.aux`, `.dvi`, `.log`など）は自動生成されます
