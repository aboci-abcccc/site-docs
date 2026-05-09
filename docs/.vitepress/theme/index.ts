import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import { Footer } from '@theojs/lumen'
import { Footer_Data } from '../data/FooterData'
import UpdateTime from './components/UpdateTime.vue'
import ArticleMetadata from './components/ArticleMetadata.vue'
import PdfViewer from './components/PdfViewer.vue'
import PdfStandaloneViewer from './components/PdfStandaloneViewer.vue'
import PdfFullscreenLayout from './components/PdfFullscreenLayout.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('UpdateTime', UpdateTime)
    app.component('ArticleMetadata', ArticleMetadata)
    app.component('PdfViewer', PdfViewer)
    app.component('PdfStandaloneViewer', PdfStandaloneViewer)
    app.component('pdf-fullscreen', PdfFullscreenLayout)
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(Footer, { Footer_Data })
    })
  }
}
