import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Next i-Reporter",
  description: "AI駆動の Excel → ConMas i-Reporter XML 変換ツール",
  lang: "ja-JP",
  ignoreDeadLinks: true,

  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "ガイド", link: "/guide/getting-started" },
      { text: "リファレンス", link: "/reference/cluster-types" },
      { text: "開発", link: "/development/how-it-works" },
    ],

    sidebar: [
      {
        text: "ガイド",
        items: [
          { text: "はじめに", link: "/guide/getting-started" },
          { text: "基本フロー", link: "/guide/basic-flow" },
          { text: "プレビューと用紙設定", link: "/guide/preview-settings" },
          { text: "クラスターエディタ", link: "/guide/cluster-editor" },
          { text: "XML インポート", link: "/guide/xml-import" },
          { text: "FAQ", link: "/guide/faq" },
        ],
      },
      {
        text: "リファレンス",
        items: [
          { text: "クラスタータイプ一覧", link: "/reference/cluster-types" },
          { text: "パラメータリファレンス", link: "/reference/parameters" },
        ],
      },
      {
        text: "開発",
        items: [
          { text: "仕組み解説", link: "/development/how-it-works" },
          { text: "AI プロンプト詳解", link: "/development/ai-prompt-analysis" },
          { text: "API リファレンス", link: "/development/api-reference" },
        ],
      },
      {
        text: "アーキテクチャ",
        items: [
          { text: "Designer 座標パイプライン対応", link: "/architecture/designer-coordinate-pipeline" },
          { text: "クラスター型（外部参照）", link: "/architecture/cluster-types-external-reference" },
          { text: "ネットワーク設定仕様", link: "/architecture/spec-network-settings" },
        ],
      },
    ],

    outline: {
      label: "目次",
    },

    docFooter: {
      prev: "前のページ",
      next: "次のページ",
    },

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "検索", buttonAriaLabel: "検索" },
          modal: {
            noResultsText: "見つかりませんでした",
            resetButtonTitle: "リセット",
            footer: { selectText: "選択", navigateText: "移動", closeText: "閉じる" },
          },
        },
      },
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/" },
    ],
  },
});
