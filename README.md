# Caption Maker

展示作品のタイトルと作者名から、A4・3列×6行のキャプション PDF を生成する静的 Web アプリです。入力内容と PDF の生成はブラウザ内で処理します。

## 使い方

作品を入力するか、`title`・`author` 列を持つ CSV またはタブ区切りの表を貼り付け、PDF をダウンロードします。入力はブラウザ内に自動保存されます。消去や端末移行に備えて CSV を書き出してください。CSV 読み込みは現在の表の末尾に追加します。

PDF は A4・実際のサイズ（100%）で印刷してください。プリンターの印刷可能領域や設定によって位置が変わるため、最初に試し刷りしてください。PDF の日本語フォントは Noto Sans JP を埋め込みます。字体は元の Figma と完全には一致しない場合があります。

## 開発・公開

Node.js 22 で `npm ci`、`npm run dev`。`npm run build` で `dist/` に静的ファイルを生成します。GitHub Pages の公開元を GitHub Actions に設定すると、main への push でデプロイされます。別の URL に配置するときは `vite.config.js` の base を変更してください。

フォントは SIL Open Font License 1.1（`public/fonts/OFL.txt`）です。
