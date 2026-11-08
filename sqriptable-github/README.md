# SQriptable GitHub（iPhone のウィジェット）

GitHub の草（日ごとの contribution）と最新の行動3件を、iPhone のホーム画面・ロック画面に出す [Scriptable](https://scriptable.app/) のスクリプトです。Rct の画面サンプルとは別のものです。

見た目の見本と入れ方（コピーのボタンつき）は、ページにもまとめています： https://katsuan.github.io/rct-mock/sqriptable-github/

## 入れ方

1. App Store で Scriptable を入れる
2. このフォルダの [`SQriptableGitHub.js`](SQriptableGitHub.js) を開き、右上の「Raw」→ 全部コピー
3. Scriptable で右上の「＋」→ 貼りつける（名前は好きなものでよい）
4. GitHub の Settings → Developer settings → Personal access tokens でトークンを作る
   - fine-grained でよい。公開リポジトリだけなら権限はなしでよい
   - 非公開リポジトリの行動やコミットのメッセージも出すなら、そのリポジトリの「Contents: Read-only」を許す
5. Scriptable でスクリプトを開いて「🔑 トークンを入れる」。トークンはその iPhone の Keychain にだけしまわれ、ファイルには書かれません
6. ホーム画面かロック画面に Scriptable のウィジェットを置き、Script に 3. で付けた名前のスクリプトを選ぶ（Parameter は空でよい）

アプリで開くと、大きさ（小・中・大・ロック画面）を選んで見た目を試せます。

## 大きさごとに出るもの

- 小：きょうの数と続いた日数、ここ13週の草
- 中：44週ほどの草と、最新の行動3件（何をした・リポジトリ・時刻）
- 大：月の名前つきの草、きょう・続いた日数・この1年、最新の行動3件
- ロック画面：1行は「🌱5 🔥12日」、丸はきょうの数、長方形は短い草

## 新しい版にするとき

このフォルダの `SQriptableGitHub.js` を、もう一度コピーして貼りなおしてください。トークンは Keychain に残るので入れなおさなくて大丈夫です。

感想・不具合は [Issue](https://github.com/katsuan/rct-mock/issues/new) へどうぞ。
