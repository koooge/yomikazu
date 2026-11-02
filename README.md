# yomikazu（読み数）

Audibleのナレーターを作品数で比較するランキングです。

[ランキングを見る](https://koooge.github.io/yomikazu/)

## 実行

```bash
bun install --frozen-lockfile
bun run refresh-data
```

`dist/index.html`をブラウザーで開きます。件数の再取得とHTML生成は同じコマンドで行えます。

候補は[`data/narrators.json`](data/narrators.json)を編集して追加します。リストから削除した名前は更新・表示の対象から外れます。現在の候補は、保存済みの件数で20以下と確認できた名前を除外しています。

名前の各要素は空白で区切って登録します。検索時は各要素を`AND`で連結します。国籍による分岐はなく、ミドルネームにも対応します。空白のない名前は自動分割しません。

```bash
# 候補を一時的に追加して更新
bun run refresh-data --name 'ナレーター名'
```

件数は`data/public-counts.json`に保存します。件数データと生成HTMLはコミットしません。

## 環境変数

| 名前                  | 説明                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| `AUDIBLE_PROXY_URL`   | プロキシのベースURL（HTTPS）。未設定・空文字の場合はAudible APIに直接接続します。 |
| `AUDIBLE_PROXY_TOKEN` | プロキシに送る共有トークン。`AUDIBLE_PROXY_URL`を設定する場合は必須です。         |

GitHub Actionsでは、`AUDIBLE_PROXY_URL`をリポジトリのActions variable、`AUDIBLE_PROXY_TOKEN`をActions secretに登録します。

プロキシ側の`PROXY_TOKEN`には、`AUDIBLE_PROXY_TOKEN`と同じ値を登録します。トークンはコミットしません。

## 集計基準

**調査対象内の暫定ランキング**です。候補の網羅性は未確認で、Audible全体の上位20位を保証しません。

- 日本版カタログAPIのナレーター検索総数を比較します。配信予定やポッドキャスト等を含む場合があります。
- 20位まで表示し、同順位は全員を含めます。同数の順位は1、1、3位です。
- 公開用の集計では空白・全角半角の表記違いを統合します。検索件数が一致しない場合や、取得失敗・未確認の候補は順位から除外します。別名・同姓同名の判定は行いません。
- 各行に件数の確認日時を表示します。

## CLIオプション

`bun src/public-counts.ts`で保存済み件数から全候補の一覧を`dist/public-ranking.html`に生成できます。

- `--refresh`：未取得・取得失敗の候補を取得。`--force`併用で全候補を更新し、上位20位も生成。
- `--name 名前`：候補を追加（複数指定可能）。`--target 名前`：全候補の一覧で強調表示。
- `--limit 人数`：1回の取得人数。`--concurrency 数`：同時取得数（既定4）。
- `--delay 秒`：各ワーカーの次の取得までの待機時間（既定0秒）。
- `--candidates`、`--counts`、`--output`：候補リスト・件数データ・一覧の出力先を変更。
