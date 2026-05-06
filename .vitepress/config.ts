import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '_abcccc',
  titleTemplate: '啊波呲',

  description: '啊波呲的个人网站',
  cleanUrls: true,
  metaChunk: true,
  lastUpdated: true,

  themeConfig: {
    sidebar: [
      {
        text: '目录',
        items: [
          { text: '自介条', link: '/intro' },
          { text: '高中笔记', link: '/notes' },
          { text: '获取金街公用手套', link: '/get-gloves' }
        ]
      }
    ],

    nav: [
      { text: '首页', link: '/' },
      { text: '更多', link: '/intro' },
      { text: 'GitHub', link: 'https://github.com/aboci-abcccc' }
    ],
    darkModeSwitchLabel: '浅色 / 深色',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    // 搜索 汉化
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索'
          },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除搜索',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    footer: {
      message: '津 ICP 备 2026004483 号 - 1',
      copyright: '© 2026 _abcccc. All Rights Reserved.'
    }
  },
  head: [
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' }
    ],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
    ],
    [
      'link',
      { href: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap', rel: 'stylesheet' }
    ]
  ]
})
