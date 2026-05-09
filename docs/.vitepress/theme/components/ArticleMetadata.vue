<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { countWord, getReadTime } from '../utils/pageStats'

const { page } = useData()

const wordCount = ref(0)
const readTime = ref(1)

function analyze() {
  const content = document.querySelector('.vp-doc')
  if (!content) return

  const clonedContent = content.cloneNode(true) as HTMLElement
  clonedContent.querySelectorAll('.article-meta-row').forEach((item) => item.remove())

  const words = clonedContent.textContent || ''
  const images = clonedContent.querySelectorAll('img')

  wordCount.value = countWord(words)
  readTime.value = getReadTime(wordCount.value, images.length)
}

onMounted(() => {
  nextTick(analyze)
})

watch(
  () => page.value.relativePath,
  () => nextTick(analyze)
)
</script>

<template>
  <span class="article-meta-item">
    <span class="article-meta-icon" aria-hidden="true">▣</span>
    字数: {{ wordCount }} 字
  </span>
  <span class="article-meta-item">
    <span class="article-meta-icon" aria-hidden="true">◷</span>
    阅读: {{ readTime }} 分钟
  </span>
</template>

<style scoped>
.article-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.article-meta-icon {
  color: var(--vp-c-text-3);
}
</style>
