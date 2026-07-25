---
layout: page
title: 排队登记
pageClass: maimai-queue-page
navbar: false
sidebar: false
prev: false
next: false
outline: false
---

<script setup>
import QueueStatusPanel from './QueueStatusPanel.vue'
</script>

<MaimaiBoardNav current="queue" />

<QueueStatusPanel />

<MaimaiBoardNav current="queue" />
