<script setup>
import {
  ChevronRight,
  Hand,
  HeartHandshake,
  ListOrdered,
  MessageCircle,
  ScrollText,
  Wrench
} from '@lucide/vue'

const services = [
  {
    key: 'queue',
    title: '排队状态',
    description: '查看现场各机台的实时排队状态',
    href: '/queue-status',
    icon: ListOrdered,
    tone: 'blue'
  },
  {
    key: 'items',
    title: '共享物品',
    description: '手套、耳机与清洁用品存放信息',
    href: '/get-gloves',
    icon: Hand,
    tone: 'green'
  },
  {
    key: 'rules',
    title: '游玩规则',
    description: '游玩须知、排卡规则与管理办法',
    href: '/maimai-rules',
    icon: ScrollText,
    tone: 'orange'
  },
  {
    key: 'crowdfunding',
    title: '维护众筹',
    description: '采购、维护安排与资金使用公示',
    href: '/crowdfunding',
    icon: Wrench,
    tone: 'purple'
  },
  {
    key: 'thanks',
    title: '特别鸣谢',
    description: '感谢参与维护、众筹与捐赠的玩家',
    href: '/maimai-thanks',
    icon: HeartHandshake,
    tone: 'pink'
  }
]
</script>

<template>
  <main class="maimai-home">
    <header class="maimai-home-header">
      <p>塘沽金街 · 舞萌 DX</p>
      <h1>金街舞萌公告板</h1>
      <span>王者之风游乐体验中心（塘沽金街店）</span>
    </header>

    <section class="maimai-service-section" aria-labelledby="maimai-service-title">
      <h2 id="maimai-service-title">服务</h2>
      <div class="maimai-service-list">
        <a
          v-for="service in services"
          :key="service.key"
          class="maimai-service-row"
          :href="service.href"
        >
          <span class="maimai-service-icon" :class="`is-${service.tone}`" aria-hidden="true">
            <component :is="service.icon" :size="22" :stroke-width="1.9" />
          </span>
          <span class="maimai-service-copy">
            <strong>{{ service.title }}</strong>
            <small>{{ service.description }}</small>
          </span>
          <ChevronRight class="maimai-service-chevron" :size="20" :stroke-width="2" aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="maimai-contact-section" aria-labelledby="maimai-contact-title">
      <h2 id="maimai-contact-title">联系</h2>
      <div class="maimai-contact-list">
        <a href="https://qm.qq.com/q/gVCWbW1Mwa">
          <span class="maimai-contact-icon is-blue" aria-hidden="true"><MessageCircle :size="21" /></span>
          <span><strong>滨海新区 maimai 交流群</strong><small>QQ群 1036015350</small></span>
          <ChevronRight :size="19" aria-hidden="true" />
        </a>
        <a href="https://qm.qq.com/q/DEf6par5v2">
          <span class="maimai-contact-icon is-gray" aria-hidden="true"><Wrench :size="21" /></span>
          <span><strong>联系维护人员</strong><small>机厅、机况或页面问题</small></span>
          <ChevronRight :size="19" aria-hidden="true" />
        </a>
      </div>
    </section>

    <footer class="maimai-home-footer">玩家公益维护 · 信息仅供现场参考</footer>
  </main>
</template>
