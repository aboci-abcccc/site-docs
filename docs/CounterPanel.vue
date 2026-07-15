<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref
} from 'vue'

const COUNTER_API_URL = 'https://abcccc.top/api/counter'

const counts = reactive({
  left: 0,
  right: 0
})

let confirmed = {
  left: 0,
  right: 0
}

const loading = ref(true)
const syncing = ref(false)
const status = ref('正在读取人数…')
const statusType = ref('busy')
const terminalOnline = ref(false)
const terminalDeviceId = ref(null)
const terminalLastSeenSeconds = ref(null)

let refreshTimer

const total = computed(() => {
  return counts.left + counts.right
})

const terminalStatusText = computed(() => {
  if (
    terminalDeviceId.value === null &&
    terminalLastSeenSeconds.value === null
  ) {
    return '终端尚未连接'
  }

  if (terminalOnline.value) {
    return `终端在线 · ${terminalLastSeenSeconds.value ?? 0}秒前`
  }

  return `终端离线 · ${terminalLastSeenSeconds.value ?? 0}秒前`
})

const terminalStatusType = computed(() => {
  if (
    terminalDeviceId.value === null &&
    terminalLastSeenSeconds.value === null
  ) {
    return 'unknown'
  }

  return terminalOnline.value ? 'online' : 'offline'
})

function normalize(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  return Math.max(0, Math.trunc(number))
}

function setStatus(message, type = 'normal') {
  status.value = message
  statusType.value = type
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 4500
) {
  const controller = new AbortController()

  const timer = window.setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    window.clearTimeout(timer)
  }
}

function applyTerminalStatus(terminal) {
  if (!terminal) {
    terminalOnline.value = false
    terminalDeviceId.value = null
    terminalLastSeenSeconds.value = null
    return
  }

  terminalOnline.value = terminal.online === true
  terminalDeviceId.value = terminal.device_id ?? null
  terminalLastSeenSeconds.value = terminal.last_seen_seconds ?? null
}

function applyServerData(data) {
  const left = normalize(data.left)
  const right = normalize(data.right)

  counts.left = left
  counts.right = right

  confirmed = {
    left,
    right
  }

  applyTerminalStatus(data.terminal)
}

async function loadCounters(silent = false) {
  if (syncing.value) {
    return
  }

  if (!silent) {
    loading.value = true
    setStatus('正在读取人数…', 'busy')
  }

  try {
    const response = await fetchWithTimeout(
      COUNTER_API_URL,
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    applyServerData(data)

    setStatus(
      `已同步 ${new Date().toLocaleTimeString('zh-CN', {
        hour12: false
      })}`,
      'success'
    )
  } catch (error) {
    if (error.name === 'AbortError') {
      setStatus('读取超时', 'error')
    } else {
      setStatus(`读取失败：${error.message}`, 'error')
    }
  } finally {
    loading.value = false
  }
}

async function saveCounters(nextLeft, nextRight) {
  if (syncing.value) {
    return
  }

  const previous = {
    ...confirmed
  }

  nextLeft = normalize(nextLeft)
  nextRight = normalize(nextRight)

  // 先更新网页数字
  counts.left = nextLeft
  counts.right = nextRight

  syncing.value = true
  setStatus('正在更新数据…', 'busy')

  try {
    const response = await fetchWithTimeout(
      COUNTER_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          left: nextLeft,
          right: nextRight
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    applyServerData(data)
    setStatus('更新成功', 'success')
  } catch (error) {
    // 同步失败后恢复服务器最后确认的数据
    counts.left = previous.left
    counts.right = previous.right

    if (error.name === 'AbortError') {
      setStatus(
        '同步超时，已恢复原数据',
        'error'
      )
    } else {
      setStatus(
        `更新失败，已恢复原数据`,
        'error'
      )
    }
  } finally {
    syncing.value = false
  }
}

function change(side, amount) {
  if (side === 'left') {
    saveCounters(
      counts.left + amount,
      counts.right
    )
  } else {
    saveCounters(
      counts.left,
      counts.right + amount
    )
  }
}

function clearSide(side) {
  if (side === 'left') {
    saveCounters(0, counts.right)
  } else {
    saveCounters(counts.left, 0)
  }
}

function clearAll() {
  if (!window.confirm('确定要清空全部人数吗？')) {
    return
  }

  saveCounters(0, 0)
}

onMounted(() => {
  loadCounters()

  refreshTimer = window.setInterval(() => {
    loadCounters(true)
  }, 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div class="counter-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">ARCADE COUNTER</p>
        <h1>机厅人数管理</h1>
        <p class="description">
          网页与现场计数终端实时同步
        </p>
      </div>

      <div class="header-status-list">
        <div
          class="terminal-status"
          :class="terminalStatusType"
          :title="terminalDeviceId ? `终端：${terminalDeviceId}` : undefined"
          aria-live="polite"
        >
          <span class="terminal-dot"></span>
          <span>{{ terminalStatusText }}</span>
        </div>

        <div
          class="status"
          :class="statusType"
        >
          <span class="status-dot"></span>
          {{ status }}
        </div>
      </div>
    </header>

    <div class="counter-grid">
      <section class="counter-card left-card">
        <div class="counter-title">
          <div>
            <span>LEFT MACHINE</span>
            <h2>左机（日框）人数</h2>
          </div>

          <strong>{{ counts.left }}</strong>
        </div>

        <div class="buttons">
          <button
            class="minus"
            :disabled="syncing || counts.left <= 0"
            @click="change('left', -1)"
          >
            −1
          </button>

          <button
            class="plus"
            :disabled="syncing"
            @click="change('left', 1)"
          >
            +1
          </button>

          <button
            class="clear"
            :disabled="syncing || counts.left <= 0"
            @click="clearSide('left')"
          >
            清空
          </button>
        </div>
      </section>

      <section class="counter-card right-card">
        <div class="counter-title">
          <div>
            <span>RIGHT MACHINE</span>
            <h2>右机（国框）人数</h2>
          </div>

          <strong>{{ counts.right }}</strong>
        </div>

        <div class="buttons">
          <button
            class="minus"
            :disabled="syncing || counts.right <= 0"
            @click="change('right', -1)"
          >
            −1
          </button>

          <button
            class="plus"
            :disabled="syncing"
            @click="change('right', 1)"
          >
            +1
          </button>

          <button
            class="clear"
            :disabled="syncing || counts.right <= 0"
            @click="clearSide('right')"
          >
            清空
          </button>
        </div>
      </section>

      <section class="total-card">
        <div>
          <span>TOTAL CAPACITY</span>
          <h2>机厅总人数</h2>
        </div>

        <strong>{{ total }}</strong>

        <button
          :disabled="syncing || total <= 0"
          @click="clearAll"
        >
          全部清空
        </button>
      </section>
    </div>

    <footer class="panel-footer">
      <button
        :disabled="loading || syncing"
        @click="loadCounters()"
      >
        刷新现场数据
      </button>

      <span>每 5 秒自动刷新一次</span>
    </footer>
  </div>
</template>

<style scoped>
.counter-panel {
  --background: #07111f;
  --card: #0d1c30;
  --card-soft: #122640;
  --text: #f4f8ff;
  --muted: #91a5bf;
  --cyan: #3bd8ff;
  --green: #55e9ac;
  --yellow: #ffc860;
  --red: #ff6879;

  max-width: 1080px;
  margin: 0 auto;
  padding: 42px 20px 70px;
  color: var(--text);
}

.panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.eyebrow,
.counter-title span,
.total-card span {
  display: block;
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.eyebrow {
  color: var(--vp-c-brand-1);
}

.counter-title span,
.total-card span {
  color: var(--cyan);
}

.panel-header h1 {
  margin: 5px 0;
  border: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(34px, 6vw, 58px);
  line-height: 1.1;
}

.description {
  margin: 0;
  color: var(--vp-c-text-2);
}

.header-status-list {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 9px;
}

.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(140, 175, 214, 0.18);
  border-radius: 999px;
  background: rgba(13, 28, 48, 0.8);
  color: #91a5bf;
  font-size: 13px;
  white-space: nowrap;
}

.terminal-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff6879;
}

.terminal-status.online {
  border-color: rgba(85, 233, 172, 0.28);
  color: #89f1c3;
}

.terminal-status.online .terminal-dot {
  background: #55e9ac;
  box-shadow: 0 0 12px #55e9ac;
}

.terminal-status.offline {
  border-color: rgba(255, 104, 121, 0.22);
  color: #ff9ba7;
}

.terminal-status.offline .terminal-dot {
  background: #ff6879;
  box-shadow: 0 0 12px rgba(255, 104, 121, 0.7);
}

.terminal-status.unknown {
  color: #b8c5d6;
}

.terminal-status.unknown .terminal-dot {
  background: #91a5bf;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid rgba(140, 175, 214, 0.18);
  border-radius: 999px;
  background: rgba(13, 28, 48, 0.8);
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--yellow);
}

.status.success .status-dot {
  background: var(--green);
  box-shadow: 0 0 12px var(--green);
}

.status.error .status-dot {
  background: var(--red);
  box-shadow: 0 0 12px var(--red);
}

.counter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.counter-card,
.total-card {
  border: 1px solid rgba(145, 178, 216, 0.16);
  border-radius: 22px;
  background:
    linear-gradient(
      145deg,
      var(--card-soft),
      var(--card)
    );
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.2);
}

.counter-card {
  padding: 27px;
}

.counter-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.counter-title h2,
.total-card h2 {
  margin: 5px 0 0;
  border: 0;
  color: #dce8f7;
  font-size: 21px;
}

.counter-title strong {
  color: white;
  font-size: clamp(65px, 9vw, 100px);
  line-height: 0.9;
}

.right-card .counter-title span {
  color: var(--green);
}

.buttons {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  margin-top: 28px;
}

button {
  min-height: 46px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.plus {
  background: var(--cyan);
  color: #03121e;
}

.right-card .plus {
  background: var(--green);
}

.minus {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: white;
}

.clear {
  background: transparent;
  color: var(--muted);
}

.total-card {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 28px;
  padding: 23px 27px;
  border-color: rgba(255, 200, 96, 0.22);
}

.total-card span {
  color: var(--yellow);
}

.total-card strong {
  color: var(--yellow);
  font-size: clamp(52px, 8vw, 78px);
}

.total-card button {
  border-color: rgba(255, 200, 96, 0.24);
  background: rgba(255, 200, 96, 0.08);
  color: #ffda92;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 20px;
}

.panel-footer button {
  border-color: rgba(130, 165, 205, 0.2);
  background: rgba(13, 28, 48, 0.8);
  color: #bfd0e5;
}

.panel-footer span {
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 700px) {
  .counter-panel {
    padding: 14px 2px 28px;
  }

  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-status-list {
    width: 100%;
    align-items: stretch;
  }

  .terminal-status,
  .status {
    justify-content: center;
  }

  .counter-grid {
    grid-template-columns: 1fr;
  }

  .counter-card {
    padding: 21px 18px;
  }

  .buttons {
    grid-template-columns: 1fr 1fr;
  }

  .buttons .clear {
    grid-column: 1 / -1;
  }

  .total-card {
    grid-column: auto;
    grid-template-columns: 1fr auto;
  }

  .total-card button {
    grid-column: 1 / -1;
    width: 100%;
  }

  .panel-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-footer button {
    width: 100%;
  }
}
</style>
