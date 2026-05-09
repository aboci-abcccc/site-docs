import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "zh-CN",
  title: "_abcccc",
  titleTemplate: "啊波呲",

  description: "啊波呲的个人网站",
  cleanUrls: true,
  metaChunk: true,
  lastUpdated: true,
  markdown: {
    config(md) {
      const defaultHeadingClose =
        md.renderer.rules.heading_close ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

      md.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
        const result = defaultHeadingClose(tokens, idx, options, env, self);

        if (tokens[idx].tag === "h1") {
          return `${result}<div class="article-meta-row"><UpdateTime /><ArticleMetadata /></div>`;
        }

        return result;
      };
    },
  },

  themeConfig: {
    sidebar: [
      {
        text: "目录",
        items: [
          { text: "自介条", link: "/intro" },
          { text: "高中笔记", link: "/notes" },
          { text: "maimai 常用资源汇总", link: "/maimai" },
          { text: "塘沽金街舞萌公告板", link: "/get-gloves" },
        ],
      },
    ],
    outline: {
      label: "本页目录",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    editLink: {
      pattern: "https://github.com/aboci-abcccc/site-docs/tree/main/docs/:path",
      text: "在 GitHub 上编辑此页",
    },
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    lastUpdated: {
      text: "上次更新时间",
    },

    nav: [
      { text: "首页", link: "/" },
      { text: "更多", link: "/intro" },
      { text: "GitHub", link: "https://github.com/aboci-abcccc" },
    ],
    darkModeSwitchLabel: "浅色 / 深色",
    lightModeSwitchTitle: "切换到浅色",
    darkModeSwitchTitle: "切换到深色",
    // 搜索 汉化
    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "搜索",
            buttonAriaLabel: "搜索",
          },
          modal: {
            noResultsText: "没有找到结果",
            resetButtonTitle: "清除搜索",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
  },
  head: [
    [
      "link",
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
    ],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    [
      "link",
      {
        href: "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
        rel: "stylesheet",
      },
    ],
  ],
});