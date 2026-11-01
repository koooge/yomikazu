# yomikazu

Audibleのナレーターを作品数で比較するランキングです。Node.jsからJSONカタログAPIで作品情報を取得し、検索・順位表示ができるHTMLとJSONを生成します。

## 実行

Node.js 26を使用します。TypeScriptをNode.jsで直接実行し、`npm run typecheck`で型チェックします。`npm run refresh-data`にも型チェックを含めています。

```bash
npm ci
npm run refresh-data
```

`dist/index.html`をブラウザーで開きます。候補リストは[`data/narrators.json`](data/narrators.json)で管理します。名前のJSON配列で、このファイルを編集して候補を追加できます。既存の検索件数データから抽出した一覧で、網羅性は未確認です。空白違いは元の表記のまま残しています。

件数取得時はこのリストを自動で読み込みます。`--candidates ファイル名`で別リストを指定でき、`--name`で一時的な候補を追加できます。取得済みの件数データにある名前も更新対象に残ります。

```bash
# 任意のナレーターを強調表示する（既定値なし）
node src/public-counts.ts --target 'ナレーター名'

# 取得済みの件数も更新
npm run refresh-data

# テスト
npm test
```

個人名の既定値はありません。保存済みのJSONデータはPython版と共通で、そのまま利用できます。取得した件数は`data/public-counts.json`に保存します。件数データと生成HTMLはGitに含めません。

## 上位20位とGitHub Pages

```bash
npm run refresh-data
```

`npm run refresh-data`は件数を取得し、`dist/index.html`と`dist/index.json`を再生成します。20位までを表示し、20位が同数なら全員を含めます。公開用の集計では空白・全角半角の表記違いを統合し、検索件数が一致しない名前は確認待ちにします。確認済みの全候補から順位を計算してから表示を絞るため、収集対象は20名に限定しません。

GitHubリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。`main`へのpush、またはActionsの **Deploy GitHub Pages → Run workflow** で、テスト・静的ビルド・公開を実行します。公開先は通常 `https://koooge.github.io/yomikazu/` です。

Actionsは公開前にAPIから候補者の件数を取得し、HTMLを生成します。件数データのコミットは不要です。ローカルで更新・表示する場合は以下を実行します。`npm run refresh-data`だけで件数取得から上位20位のHTML生成まで実行します。

```bash
# 保存済みの候補を再取得
npm run refresh-data

# 比較対象を追加して再取得
npm run refresh-data -- --name 'ナレーター名'
```

ビルド日時はJSONの`generated_at`、実際の確認日時は各行の`checked_at`に保存します。現在のスナップショットは限定した候補の調査結果で、全体の上位20位を保証するものではありません。

## 集計基準

現段階は**件数を確認できた掲載ナレーター間の暫定順位**です。Audible全体での順位は未確定です。

- 指標はAudible.co.jpのカタログAPIのナレーター検索の総件数（全言語）。配信予定やポッドキャスト等を含む場合があります。
- 同数は同順位（1、1、3位）。「○件以上」、未確認、取得失敗は順位から除外します。
- 検索件数方式では名前の表記ゆれは未統合です。掲載人数が実人数と一致しない場合があります。
- 確認日時を表示します。更新は手動です。

次は比較対象の拡充、別名管理、作品IDによる照合、定期更新・順位履歴の追加を進めます。

## データ取得方針

HTMLスクレイピングは使用しません。Node.jsのfetchでAudible日本版のJSON APIを利用します。カタログ検索はAPIキー・ログイン不要ですが、公式に公開・サポートされたAPIではありません。

現在の公開用スナップショットには旧HTML検索由来のデータが残っています。`npm run refresh-data`でAPIから再取得した行には取得元と`source_type`を保存します。APIへの全件移行はまだ完了していません。

## CLIオプション

`node src/public-counts.ts`は候補リストを読み込み、保存した件数から全候補のHTMLを`dist/public-ranking.html`に生成します。公開用の上位20位は`npm run refresh-data`で`dist/index.html`に生成します。

- `--refresh`：未取得・取得失敗の候補をAPIから取得。`--force`併用で全候補を更新。
- `--name 名前`：候補を一時追加（複数指定可能）。`--target 名前`：任意の人を強調表示。
- `--limit 人数`：1回の取得人数。`--delay 秒`：取得間隔（既定3秒、最小1秒）。
- `--candidates`、`--counts`、`--output`：候補リスト・件数データ・出力先を変更。

既定のデータ・出力パスは実行ディレクトリによらずリポジトリ内の`data/`と`dist/`を指します。テストは`test/`に配置しています。
