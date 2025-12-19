# IPSJ論文テンプレート - vol1.tex

このディレクトリには、情報処理学会（IPSJ）の論文テンプレートを使用した日本語論文作成環境が整っています。

## ファイル構成

- **vol1.tex**: あなたの論文ファイル（編集するメインファイル）
- **vol1.pdf**: コンパイル後に生成されるPDFファイル
- **compile.sh**: 簡単にコンパイルできるスクリプト
- **ipsj.cls**: IPSJ論文用スタイルファイル
- **jsample.tex**: 日本語サンプル論文（参考用）

## 使い方

### 方法1: スクリプトを使う（推奨）

```bash
./compile.sh
```

このスクリプトを実行すると、自動的に：
1. vol1.texをコンパイル（2回）
2. PDFに変換
3. 生成されたPDFを開く

### 方法2: 手動でコンパイル

```bash
platex vol1.tex
platex vol1.tex
dvipdfmx vol1.dvi
open vol1.pdf
```

### 方法3: ワークフローコマンド

Antigravityを使っている場合：
```
/compile
```

## 論文の編集

`vol1.tex`を開いて、以下の部分を編集してください：

1. **タイトル**: `\title{}`と`\etitle{}`
2. **著者情報**: `\author{}`と`\affiliate{}`
3. **概要**: `\begin{abstract}`と`\begin{eabstract}`
4. **キーワード**: `\begin{jkeyword}`と`\begin{ekeyword}`
5. **本文**: 各セクション（`\section{}`）の内容
6. **参考文献**: `\begin{thebibliography}`内
7. **著者紹介**: `\begin{biography}`内

## 参考

- サンプル論文: `jsample.tex`と`jsample.pdf`を参照
- 詳しい使い方: jsample.pdfに詳細な説明があります
- IPSJ公式: http://www.ipsj.or.jp/journal/submit/style.html

## トラブルシューティング

### コンパイルエラーが出た場合

1. `vol1.log`ファイルを確認してエラー内容を確認
2. 日本語の文字コードがUTF-8になっているか確認
3. 必要なパッケージがすべて揃っているか確認

### 中間ファイルを削除したい場合

```bash
rm -f vol1.aux vol1.dvi vol1.log
```

## 注意事項

- 日本語で論文を書く場合は、文字コードを**UTF-8**に設定してください
- 参考文献を使う場合は、BibTeXの処理も必要になります
- 図表を挿入する場合は、EPSまたはPDF形式の画像を使用してください
