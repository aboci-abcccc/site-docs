<script setup>
defineProps({
  current: {
    type: String,
    default: ''
  },
  backOnly: {
    type: Boolean,
    default: false
  }
})

const links = [
  { key: 'queue', label: '排队登记', href: '/queue-status', icon: '○' },
  { key: 'counter', label: '机厅人数统计', href: '/counter', icon: '◎' },
  { key: 'items', label: '获取机厅物品', href: '/get-gloves', icon: '◈' },
  { key: 'rules', label: '相关规则', href: '/maimai-rules', icon: '◇' },
  { key: 'thanks', label: '特别鸣谢', href: '/maimai-thanks', icon: '✦' }
]
</script>

<template>
  <nav class="maimai-page-nav" aria-label="金街舞萌公告板导航">
    <a class="maimai-back" href="/maimai-board">← 返回公告板</a>

    <div v-if="!backOnly" class="maimai-page-links">
      <a
        v-for="link in links"
        :key="link.key"
        :href="link.href"
        :class="{ active: current === link.key }"
        :aria-current="current === link.key ? 'page' : undefined"
      >
        <span aria-hidden="true">{{ link.icon }}</span>
        {{ link.label }}
      </a>
    </div>
  </nav>
</template>
