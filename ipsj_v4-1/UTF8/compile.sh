#!/bin/bash

# vol1.texをコンパイルしてvol1.pdfを生成するスクリプト

echo "=== vol1.tex のコンパイルを開始します ==="

# 1回目のコンパイル
echo "1回目のplatexコンパイル..."
platex vol1.tex

# 2回目のコンパイル（相互参照を確定）
echo "2回目のplatexコンパイル..."
platex vol1.tex

# DVIをPDFに変換
echo "PDFに変換中..."
dvipdfmx vol1.dvi

# 完了メッセージ
if [ -f vol1.pdf ]; then
    echo "=== コンパイル完了！vol1.pdf が生成されました ==="
    echo "PDFを開きます..."
    open vol1.pdf
else
    echo "=== エラー: PDFの生成に失敗しました ==="
    exit 1
fi
