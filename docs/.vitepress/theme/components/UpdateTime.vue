<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()

const updatedAt = computed(() => {
  if (!page.value.lastUpdated) return ''

  return new Date(page.value.lastUpdated).toLocaleDateString('zh-CN')
})
</script>

<template>
  <span v-if="updatedAt" class="article-meta-item">
    <span class="article-meta-icon" aria-hidden="true">↻</span>
    更新: {{ updatedAt }}
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
