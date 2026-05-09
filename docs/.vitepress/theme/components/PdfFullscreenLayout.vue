<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PdfViewer from './PdfViewer.vue'

const source = ref('')
const title = ref('PDF 阅读器')
const viewerHeight = ref(900)

function syncFromLocation() {
  const params = new URLSearchParams(window.location.search)

  source.value = params.get('src') || ''
  title.value = params.get('title') || 'PDF 阅读器'
}

function syncHeight() {
  viewerHeight.value = window.innerHeight || 900
}

onMounted(() => {
  syncFromLocation()
  syncHeight()
  window.addEventListener('resize', syncHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncHeight)
})
</script>

<template>
  <main class="pdf-fullscreen-layout">
    <PdfViewer
      v-if="source"
      :src="source"
      :title="title"
      :height="viewerHeight"
      :show-title="false"
      :show-open-button="false"
      initial-fullscreen
    />
    <div v-else class="pdf-fullscreen-empty">未指定 PDF 文件。</div>
  </main>
</template>
