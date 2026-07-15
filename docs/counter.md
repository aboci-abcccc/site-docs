---
layout: page
title: 机厅人数管理
pageClass: maimai-counter-page
navbar: false
sidebar: false
prev: false
next: false
outline: false
---

<script setup>
import CounterPanel from './CounterPanel.vue'
</script>

<MaimaiBoardNav current="counter" />

<CounterPanel />

<section class="terminal-guide" aria-labelledby="terminal-guide-title">
  <div class="terminal-guide-heading">
    <p>ON-SITE TERMINAL GUIDE</p>
    <h2 id="terminal-guide-title">现场终端使用教程</h2>
    <span>操作前请先查看终端屏幕，确认当前选中的是左机还是右机。</span>
  </div>

  <ol class="terminal-guide-steps">
    <li>
      <strong>正面蓝色按键</strong>
      <span><code>单击</code>：当前选中的机台人数 +1</span>
      <span><code>长按</code>：当前选中的机台人数清零</span>
    </li>
    <li>
      <strong>右侧按键</strong>
      <span><code>单击</code>：切换当前选中的机台</span>
      <span><code>双击</code>：当前选中的机台人数 −1</span>
      <span><code>长按</code>：两台机台人数全部清零</span>
    </li>
    <li>
      <strong>左侧按键</strong>
      <span><code>单击</code>：重启终端</span>
      <span><code>长按</code>：关闭终端</span>
    </li>
  </ol>

  <div class="terminal-guide-note">
    <strong>请注意</strong>
    <span>清零、全部清零和关机都是长按操作。操作前请再次确认，日常计数时不要长按按键。</span>
  </div>
</section>

<MaimaiBoardNav current="counter" />
