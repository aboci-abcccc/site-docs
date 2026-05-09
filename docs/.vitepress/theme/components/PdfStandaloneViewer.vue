<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PdfViewer from './PdfViewer.vue'

const source = ref('')
const title = ref('PDF 阅读器')

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  source.value = params.get('src') || ''
  title.value = params.get('title') || 'PDF 阅读器'
})
</script>

<template>
  <div class="pdf-standalone-viewer">
    <PdfViewer v-if="source" :src="source" :title="title" :height="900" />
    <div v-else class="pdf-standalone-empty">未指定 PDF 文件。</div>
  </div>
</template>
