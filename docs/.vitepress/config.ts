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
    ],

    sidebar: [
      {
        text: "ガイド",
        items: [
          { text: "はじめに", link: "/guide/getting-started" },
          { text: "基本フロー", link: "/guide/basic-flow" },
          { text: "クラスターエディタ", link: "/guide/cluster-editor" },
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
