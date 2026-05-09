import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import { Footer } from '@theojs/lumen'
import { Footer_Data } from '../data/FooterData'
import UpdateTime from './components/UpdateTime.vue'
import ArticleMetadata from './components/ArticleMetadata.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('UpdateTime', UpdateTime)
    app.component('ArticleMetadata', ArticleMetadata)
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(Footer, { Footer_Data })
    })
  }
}
