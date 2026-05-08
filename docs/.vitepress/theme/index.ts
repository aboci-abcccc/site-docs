import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import { Footer } from '@theojs/lumen'
import { Footer_Data } from '../data/FooterData'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(Footer, { Footer_Data })
    })
  }
}
