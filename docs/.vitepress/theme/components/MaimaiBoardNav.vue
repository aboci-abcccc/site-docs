<script setup>
import {
  ChevronLeft,
  Hand,
  HeartHandshake,
  ListOrdered,
  ScrollText,
  Wrench
} from '@lucide/vue'

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
  { key: 'queue', label: '排队', href: '/queue-status', icon: ListOrdered },
  { key: 'items', label: '物品', href: '/get-gloves', icon: Hand },
  { key: 'rules', label: '规则', href: '/maimai-rules', icon: ScrollText },
  { key: 'crowdfunding', label: '维护', href: '/crowdfunding', icon: Wrench },
  { key: 'thanks', label: '鸣谢', href: '/maimai-thanks', icon: HeartHandshake }
]
</script>

<template>
  <nav class="maimai-page-nav" aria-label="金街舞萌公告板导航">
    <a class="maimai-back" href="/maimai-board">
      <ChevronLeft :size="18" aria-hidden="true" />
      <span>公告板</span>
    </a>

    <div v-if="!backOnly" class="maimai-page-links">
      <a
        v-for="link in links"
        :key="link.key"
        :href="link.href"
        :class="{ active: current === link.key }"
        :aria-current="current === link.key ? 'page' : undefined"
      >
        <component :is="link.icon" :size="17" :stroke-width="1.9" aria-hidden="true" />
        <span>{{ link.label }}</span>
      </a>
    </div>
  </nav>
</template>
