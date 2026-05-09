<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { withBase } from 'vitepress'
import 'vue-pdf-embed/dist/styles/annotationLayer.css'
import 'vue-pdf-embed/dist/styles/textLayer.css'

const VuePdfEmbed = defineAsyncComponent(async () => {
  const [{ default: component, GlobalWorkerOptions }, { default: workerSrc }] = await Promise.all([
    import('vue-pdf-embed/dist/index.essential.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker&url')
  ])

  GlobalWorkerOptions.workerSrc = workerSrc

  return component
})

const PAGE_GAP = 28
const STAGE_PADDING = 24
const VIRTUAL_BUFFER = 2
const THUMBNAIL_ROW_HEIGHT = 148
const THUMBNAIL_BUFFER = 2
const THUMBNAIL_CARD_WIDTH = 128
const THUMBNAIL_PAPER_WIDTH = 92

type SidebarMode = 'outline' | 'thumbs'
type ZoomValue = 'auto' | string
type PdfDestination = unknown[] | string | null | undefined

type PdfOutlineItem = {
  title?: string
  dest?: PdfDestination
  url?: string
  items?: PdfOutlineItem[]
}

type PdfPageProxyLike = {
  view?: number[]
  cleanup?: () => void
  getViewport?: (options: { scale: number; rotation?: number }) => { width: number; height: number }
  render?: (context: {
    canvasContext: CanvasRenderingContext2D | null
    viewport: { width: number; height: number }
    transform?: number[] | null
    background?: string
  }) => {
    promise: Promise<void>
    cancel?: () => void
  }
}

type PdfDocumentProxyLike = {
  numPages: number
  getPage?: (pageNumber: number) => Promise<PdfPageProxyLike>
  getOutline?: () => Promise<PdfOutlineItem[] | null>
  getDestination?: (destination: string) => Promise<unknown[] | null>
  getPageIndex?: (ref: unknown) => Promise<number>
}

type OutlineEntry = {
  id: string
  title: string
  level: number
  page?: number
  url?: string
}

const props = withDefaults(
  defineProps<{
    src: string
    title?: string
    height?: number
    showTitle?: boolean
    initialFullscreen?: boolean
    showOpenButton?: boolean
  }>(),
  {
    height: 820,
    showTitle: true,
    initialFullscreen: false,
    showOpenButton: true
  }
)

const pdfSource = computed(() => withBase(props.src))
const pdfDoc = shallowRef<PdfDocumentProxyLike | null>(null)
const currentPage = ref(1)
const pageInput = ref('1')
const pageCount = ref(0)
const sidebarMode = ref<SidebarMode>('outline')
const isSidebarOpen = ref(false)
const outline = ref<OutlineEntry[]>([])
const isOutlineLoading = ref(false)
const loadError = ref('')
const zoomValue = ref<ZoomValue>('auto')
const basePageWidth = ref(720)
const basePageHeight = ref(1018)
const stageRef = ref<HTMLElement | null>(null)
const thumbnailScrollRef = ref<HTMLElement | null>(null)
const thumbnailCanvasRef = ref<HTMLElement | null>(null)
const stageWidth = ref(0)
const viewportHeight = ref(props.height)
const scrollTop = ref(0)
const thumbnailScrollTop = ref(0)
const thumbnailViewportHeight = ref(0)
const appliedRenderWidth = ref(720)
const renderKey = ref(0)
const isScrollSyncing = ref(false)
const isFullscreen = ref(props.initialFullscreen)
const thumbnailError = ref(false)

let resizeObserver: ResizeObserver | null = null
let thumbnailResizeObserver: ResizeObserver | null = null
let thumbnailLeafer: { destroy: () => void } | null = null
let scrollFrame = 0
let widthTimer = 0
let thumbnailFrame = 0
let thumbnailMetricsFrame = 0
let scrollSyncTimer = 0
let thumbnailRenderVersion = 0
let scrollLockApplied = false

const thumbnailImageCache = new Map<number, string>()
const thumbnailPendingPages = new Set<number>()
const ZOOM_PRESETS = ['0.25', '0.5', '0.75', '1', '1.25', '1.5', '2', '3', '4', '5', '7.5', '10'] as const
const MIN_ZOOM_SCALE = 0.25
const MAX_ZOOM_SCALE = 10
const ZOOM_STEP = 1.25

const pageNumbers = computed(() =>
  Array.from({ length: pageCount.value }, (_, index) => index + 1)
)

const sidebarTitle = computed(() => (sidebarMode.value === 'outline' ? '文档目录' : '页面缩略图'))
const currentZoomScale = computed(() => {
  if (zoomValue.value === 'auto') {
    return Math.max(MIN_ZOOM_SCALE, renderWidth.value / Math.max(1, basePageWidth.value))
  }

  const scale = Number(zoomValue.value)

  return Number.isFinite(scale) ? clampZoomScale(scale) : 1
})
const zoomPercentLabel = computed(() => `${Math.round(currentZoomScale.value * 100)}%`)
const zoomSelectLabel = computed(() =>
  zoomValue.value === 'auto' ? '自动适应' : zoomPercentLabel.value
)
const isPresetZoomSelected = computed(() =>
  zoomValue.value === 'auto' || ZOOM_PRESETS.includes(zoomValue.value as (typeof ZOOM_PRESETS)[number])
)

const renderWidth = computed(() => {
  if (zoomValue.value === 'auto') {
    const available = stageWidth.value - STAGE_PADDING * 2

    return available > 0 ? Math.min(available, 960) : basePageWidth.value
  }

  return Math.round(basePageWidth.value * Number(zoomValue.value))
})

const pageAspectRatio = computed(() => {
  if (basePageWidth.value <= 0) {
    return 1.414
  }

  return basePageHeight.value / basePageWidth.value
})

const pageHeight = computed(() => Math.max(1, Math.round(appliedRenderWidth.value * pageAspectRatio.value)))
const pageStride = computed(() => pageHeight.value + PAGE_GAP)
const totalDocumentHeight = computed(() => {
  if (!pageCount.value) {
    return 0
  }

  return pageCount.value * pageHeight.value + (pageCount.value - 1) * PAGE_GAP
})

const virtualPages = computed(() => {
  if (!pageCount.value || !pdfDoc.value) {
    return []
  }

  const contentTop = Math.max(0, scrollTop.value - STAGE_PADDING)
  const contentBottom = contentTop + viewportHeight.value + STAGE_PADDING * 2
  const startPage = clampPage(Math.floor(contentTop / pageStride.value) + 1 - VIRTUAL_BUFFER)
  const endPage = clampPage(Math.ceil(contentBottom / pageStride.value) + VIRTUAL_BUFFER)

  return Array.from(
    { length: Math.max(0, endPage - startPage + 1) },
    (_, index) => startPage + index
  )
})

const thumbnailCanvasHeight = computed(() => Math.max(180, pageCount.value * THUMBNAIL_ROW_HEIGHT + 16))
const thumbnailViewportCanvasHeight = computed(() =>
  Math.max(180, thumbnailViewportHeight.value || props.height - 48)
)
const visibleThumbnailPages = computed(() => {
  if (!pageCount.value) {
    return []
  }

  const top = Math.max(0, thumbnailScrollTop.value)
  const bottom = top + thumbnailViewportCanvasHeight.value
  const startPage = clampPage(Math.floor(top / THUMBNAIL_ROW_HEIGHT) + 1 - THUMBNAIL_BUFFER)
  const endPage = clampPage(Math.ceil(bottom / THUMBNAIL_ROW_HEIGHT) + THUMBNAIL_BUFFER)

  return Array.from(
    { length: Math.max(0, endPage - startPage + 1) },
    (_, index) => startPage + index
  )
})
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => pageCount.value > 0 && currentPage.value < pageCount.value)
const standaloneViewerUrl = computed(() => {
  const params = new URLSearchParams({
    src: props.src,
    title: props.title || 'PDF 阅读器'
  })

  return `${withBase('/pdf-viewer')}?${params.toString()}`
})

const canZoomOut = computed(() => {
  return currentZoomScale.value > MIN_ZOOM_SCALE
})

const canZoomIn = computed(() => {
  return currentZoomScale.value < MAX_ZOOM_SCALE
})

watch(currentPage, (page) => {
  pageInput.value = String(page)
  scheduleThumbnailRender()
})

watch(renderWidth, (width) => {
  scheduleApplyRenderWidth(width)
})

watch([isSidebarOpen, sidebarMode, pageCount], () => {
  if (isSidebarOpen.value && sidebarMode.value === 'thumbs') {
    scheduleThumbnailRender()
  } else {
    destroyThumbnailLeafer()
  }
})

watch(
  () => props.src,
  () => {
    pdfDoc.value = null
    currentPage.value = 1
    pageInput.value = '1'
    pageCount.value = 0
    outline.value = []
    loadError.value = ''
    zoomValue.value = 'auto'
    isSidebarOpen.value = false
    scrollTop.value = 0
    renderKey.value += 1
    clearThumbnailCache()
    destroyThumbnailLeafer()
  }
)

function clampPage(page: number) {
  const maxPage = pageCount.value || 1

  return Math.min(Math.max(page, 1), maxPage)
}

function clampZoomScale(scale: number) {
  return Math.min(Math.max(scale, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE)
}

function formatZoomValue(scale: number): ZoomValue {
  return String(Math.round(clampZoomScale(scale) * 100) / 100)
}

function getPageTop(page: number) {
  return (clampPage(page) - 1) * pageStride.value
}

function getVisiblePageFromScroll() {
  if (!pageCount.value) {
    return 1
  }

  const contentTop = Math.max(0, scrollTop.value - STAGE_PADDING)
  const readingLine = contentTop + viewportHeight.value * 0.38
  let page = Math.floor(readingLine / pageStride.value) + 1
  const pageTop = getPageTop(page)
  const pageBottom = pageTop + pageHeight.value

  if (readingLine > pageBottom + PAGE_GAP / 2) {
    page += 1
  }

  return clampPage(page)
}

function updateStageMetrics() {
  const stage = stageRef.value

  if (!stage) {
    return
  }

  stageWidth.value = stage.clientWidth
  viewportHeight.value = stage.clientHeight
  scrollTop.value = stage.scrollTop

  if (!isScrollSyncing.value) {
    const nextPage = getVisiblePageFromScroll()

    if (nextPage !== currentPage.value) {
      currentPage.value = nextPage
    }
  }
}

function scheduleScrollMetrics() {
  if (typeof window === 'undefined' || scrollFrame) {
    return
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    updateStageMetrics()
  })
}

function scrollToPage(page: number, behavior: ScrollBehavior = 'smooth') {
  const stage = stageRef.value
  const clamped = clampPage(page)

  currentPage.value = clamped

  if (!stage) {
    return
  }

  isScrollSyncing.value = true
  window.clearTimeout(scrollSyncTimer)
  stage.scrollTo({
    top: STAGE_PADDING + getPageTop(clamped),
    behavior
  })
  scrollSyncTimer = window.setTimeout(() => {
    isScrollSyncing.value = false
    updateStageMetrics()
  }, behavior === 'smooth' ? 450 : 0)
}

function goToPage(page: number | undefined) {
  if (!page) {
    return
  }

  scrollToPage(page)
}

function goToPrevPage() {
  goToPage(currentPage.value - 1)
}

function goToNextPage() {
  goToPage(currentPage.value + 1)
}

function commitPageInput() {
  const nextPage = Number.parseInt(pageInput.value, 10)

  if (Number.isNaN(nextPage)) {
    pageInput.value = String(currentPage.value)
    return
  }

  goToPage(nextPage)
}

function handlePageInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    commitPageInput()
  }

  if (event.key === 'Escape') {
    pageInput.value = String(currentPage.value)
  }
}

function toggleSidebar(mode: SidebarMode) {
  if (isSidebarOpen.value && sidebarMode.value === mode) {
    isSidebarOpen.value = false
    return
  }

  sidebarMode.value = mode
  isSidebarOpen.value = true

  if (mode === 'thumbs') {
    void nextTick(() => {
      updateThumbnailMetrics()
      ensureThumbnailPageVisible(currentPage.value)
      scheduleThumbnailRender()
    })
  }
}

function setPdfError(error: Error) {
  const message = error.message || 'PDF 加载失败'

  if (message.includes('Cannot use the same canvas during multiple render')) {
    return
  }

  loadError.value = message
}

function zoomOut() {
  zoomValue.value = formatZoomValue(currentZoomScale.value / ZOOM_STEP)
}

function zoomIn() {
  zoomValue.value = formatZoomValue(currentZoomScale.value * ZOOM_STEP)
}

function resetZoom() {
  zoomValue.value = '1'
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value

  void nextTick(() => {
    updateStageMetrics()
    scheduleApplyRenderWidth(renderWidth.value)
  })
}

function downloadPdf() {
  const link = document.createElement('a')
  link.href = pdfSource.value
  link.download = props.title || 'document.pdf'
  link.click()
}

function printPdf() {
  window.open(pdfSource.value, '_blank')
}

function scheduleApplyRenderWidth(width: number | undefined) {
  if (!width || width <= 0) {
    return
  }

  const nextWidth = Math.round(width)

  if (typeof window === 'undefined') {
    appliedRenderWidth.value = nextWidth
    return
  }

  window.clearTimeout(widthTimer)
  widthTimer = window.setTimeout(() => {
    if (appliedRenderWidth.value === nextWidth) {
      return
    }

    const anchorPage = currentPage.value
    appliedRenderWidth.value = nextWidth
    renderKey.value += 1

    void nextTick(() => {
      scrollToPage(anchorPage, 'auto')
    })
  }, 140)
}

async function handleLoaded(doc: PdfDocumentProxyLike) {
  pdfDoc.value = doc
  pageCount.value = doc.numPages
  currentPage.value = clampPage(currentPage.value)
  loadError.value = ''

  await Promise.all([loadPageBaseSize(doc), loadOutline(doc)])

  await nextTick()
  setupResizeObserver()
  scheduleApplyRenderWidth(renderWidth.value)
  updateStageMetrics()
}

async function loadPageBaseSize(doc: PdfDocumentProxyLike) {
  if (!doc.getPage) {
    return
  }

  try {
    const firstPage = await doc.getPage(1)
    const view = firstPage.view
    const width = Array.isArray(view) ? Math.abs((view[2] ?? 0) - (view[0] ?? 0)) : 0
    const height = Array.isArray(view) ? Math.abs((view[3] ?? 0) - (view[1] ?? 0)) : 0

    if (width > 0) {
      basePageWidth.value = width
    }

    if (height > 0) {
      basePageHeight.value = height
    }

    firstPage.cleanup?.()
  } catch {
    basePageWidth.value = 720
    basePageHeight.value = 1018
  }
}

async function loadOutline(doc: PdfDocumentProxyLike) {
  outline.value = []

  if (!doc.getOutline) {
    return
  }

  isOutlineLoading.value = true

  try {
    const rawOutline = await doc.getOutline()

    if (!rawOutline?.length) {
      return
    }

    const entries: OutlineEntry[] = []
    let index = 0

    async function walk(items: PdfOutlineItem[], level = 0) {
      for (const item of items) {
        const title = item.title?.trim() || '未命名目录'
        const page = await resolveDestinationPage(doc, item.dest)

        entries.push({
          id: `${level}-${index++}`,
          title,
          level,
          page,
          url: item.url
        })

        if (item.items?.length) {
          await walk(item.items, level + 1)
        }
      }
    }

    await walk(rawOutline)
    outline.value = entries
  } catch {
    outline.value = []
  } finally {
    isOutlineLoading.value = false
  }
}

async function resolveDestinationPage(doc: PdfDocumentProxyLike, destination: PdfDestination) {
  if (!destination) {
    return undefined
  }

  try {
    const resolvedDestination =
      typeof destination === 'string'
        ? await doc.getDestination?.(destination)
        : destination

    if (!Array.isArray(resolvedDestination) || !resolvedDestination.length) {
      return undefined
    }

    const pageRef = resolvedDestination[0]

    if (typeof pageRef === 'number') {
      return clampPage(pageRef + 1)
    }

    if (!doc.getPageIndex) {
      return undefined
    }

    const pageIndex = await doc.getPageIndex(pageRef)

    return clampPage(pageIndex + 1)
  } catch {
    return undefined
  }
}

function openOutlineEntry(entry: OutlineEntry) {
  if (entry.page) {
    goToPage(entry.page)
    return
  }

  if (entry.url) {
    window.open(entry.url, '_blank', 'noopener,noreferrer')
  }
}

function setupResizeObserver() {
  resizeObserver?.disconnect()

  if (!stageRef.value || typeof ResizeObserver === 'undefined') {
    return
  }

  updateStageMetrics()

  resizeObserver = new ResizeObserver(() => {
    updateStageMetrics()
    scheduleApplyRenderWidth(renderWidth.value)
  })

  resizeObserver.observe(stageRef.value)
}

function syncDocumentScrollLock(locked: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('pdf-viewer-lock-scroll', locked)
  document.body.classList.toggle('pdf-viewer-lock-scroll', locked)
  scrollLockApplied = locked
}

function clearThumbnailCache() {
  thumbnailRenderVersion += 1
  thumbnailImageCache.clear()
  thumbnailPendingPages.clear()
}

function destroyThumbnailLeafer() {
  thumbnailLeafer?.destroy()
  thumbnailLeafer = null
}

function updateThumbnailMetrics() {
  const scroller = thumbnailScrollRef.value

  if (!scroller) {
    return
  }

  thumbnailScrollTop.value = scroller.scrollTop
  thumbnailViewportHeight.value = scroller.clientHeight
  scheduleThumbnailRender()
}

function scheduleThumbnailMetrics() {
  if (typeof window === 'undefined' || thumbnailMetricsFrame) {
    return
  }

  thumbnailMetricsFrame = window.requestAnimationFrame(() => {
    thumbnailMetricsFrame = 0
    updateThumbnailMetrics()
  })
}

function ensureThumbnailPageVisible(page: number) {
  const scroller = thumbnailScrollRef.value

  if (!scroller) {
    return
  }

  const top = (clampPage(page) - 1) * THUMBNAIL_ROW_HEIGHT
  const bottom = top + THUMBNAIL_ROW_HEIGHT
  const visibleTop = scroller.scrollTop
  const visibleBottom = visibleTop + scroller.clientHeight

  if (top >= visibleTop + 8 && bottom <= visibleBottom - 8) {
    return
  }

  scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2 + THUMBNAIL_ROW_HEIGHT / 2)
  updateThumbnailMetrics()
}

function scheduleThumbnailRender() {
  if (
    typeof window === 'undefined' ||
    !isSidebarOpen.value ||
    sidebarMode.value !== 'thumbs' ||
    !pageCount.value ||
    !pdfDoc.value
  ) {
    return
  }

  window.cancelAnimationFrame(thumbnailFrame)
  thumbnailFrame = window.requestAnimationFrame(() => {
    void renderThumbnailCanvas()
  })
}

async function renderThumbnailCanvas() {
  await nextTick()

  const container = thumbnailCanvasRef.value

  if (!container || sidebarMode.value !== 'thumbs' || !isSidebarOpen.value) {
    return
  }

  try {
    const { Leafer, Rect, Text, Image: LeaferImage } = (await import('leafer-ui')) as any
    const width = Math.max(160, container.clientWidth || 190)
    const height = thumbnailViewportCanvasHeight.value
    const visiblePages = visibleThumbnailPages.value

    destroyThumbnailLeafer()
    container.innerHTML = ''
    thumbnailError.value = false

    const leafer = new Leafer({
      view: container,
      width,
      height,
      start: false
    })

    thumbnailLeafer = leafer

    for (const page of visiblePages) {
      const y = 8 + (page - 1) * THUMBNAIL_ROW_HEIGHT - thumbnailScrollTop.value
      const isActive = page === currentPage.value
      const cardWidth = THUMBNAIL_CARD_WIDTH
      const cardX = (width - cardWidth) / 2
      const paperWidth = THUMBNAIL_PAPER_WIDTH
      const paperHeight = Math.min(118, Math.round(paperWidth * pageAspectRatio.value))
      const paperX = (width - paperWidth) / 2
      const paperY = y + 10
      const thumbnailUrl = thumbnailImageCache.get(page)

      const card = new Rect({
        x: cardX,
        y,
        width: cardWidth,
        height: THUMBNAIL_ROW_HEIGHT - 12,
        fill: isActive ? 'rgba(58,151,109,0.28)' : 'rgba(255,255,255,0.08)',
        stroke: isActive ? 'rgba(58,151,109,0.72)' : 'rgba(255,255,255,0.08)',
        strokeWidth: 1,
        cornerRadius: 10
      })

      const paper = new Rect({
        x: paperX,
        y: paperY,
        width: paperWidth,
        height: paperHeight,
        fill: '#fff',
        stroke: 'rgba(0,0,0,0.08)',
        strokeWidth: 1,
        cornerRadius: 3
      })

      const pageItems = [card]

      if (thumbnailUrl) {
        pageItems.push(
          new LeaferImage({
            x: paperX,
            y: paperY,
            width: paperWidth,
            height: paperHeight,
            url: thumbnailUrl,
            cornerRadius: 3,
            hittable: false
          })
        )
      } else {
        const lineColor = page === currentPage.value ? '#3a976d' : '#d7d7d7'

        pageItems.push(
          paper,
          new Rect({ x: paperX + 14, y: paperY + 20, width: 64, height: 3, fill: lineColor, cornerRadius: 2 }),
          new Rect({ x: paperX + 14, y: paperY + 36, width: 52, height: 3, fill: '#e6e6e6', cornerRadius: 2 }),
          new Rect({ x: paperX + 14, y: paperY + 52, width: 58, height: 3, fill: '#e6e6e6', cornerRadius: 2 }),
          new Text({
            x: 0,
            y: paperY + paperHeight / 2 - 8,
            width,
            text: '加载中',
            fill: 'rgba(0,0,0,0.32)',
            fontSize: 12,
            textAlign: 'center',
            hittable: false
          })
        )

        void renderPdfThumbnail(page)
      }

      const pageText = new Text({
        x: 0,
        y: y + 130,
        width,
        text: `第 ${page} 页`,
        fill: isActive ? '#fff' : 'rgba(255,255,255,0.78)',
        fontSize: 12,
        textAlign: 'center',
        hittable: false
      })
      const hitArea = new Rect({
        x: cardX,
        y,
        width: cardWidth,
        height: THUMBNAIL_ROW_HEIGHT - 12,
        fill: 'rgba(0,0,0,0.001)',
        stroke: 'rgba(0,0,0,0)',
        cornerRadius: 10,
        button: true
      })

      hitArea.on('tap', () => goToPage(page))
      hitArea.on('pointer.enter', () => {
        card.fill = isActive ? 'rgba(58,151,109,0.34)' : 'rgba(255,255,255,0.13)'
      })
      hitArea.on('pointer.leave', () => {
        card.fill = isActive ? 'rgba(58,151,109,0.28)' : 'rgba(255,255,255,0.08)'
      })

      for (const item of [...pageItems, pageText, hitArea]) {
        leafer.add(item)
      }
    }

    leafer.start?.()
  } catch {
    thumbnailError.value = true
    destroyThumbnailLeafer()
  }
}

async function renderPdfThumbnail(pageNumber: number) {
  const doc = pdfDoc.value

  if (
    !doc?.getPage ||
    thumbnailImageCache.has(pageNumber) ||
    thumbnailPendingPages.has(pageNumber)
  ) {
    return
  }

  const version = thumbnailRenderVersion
  thumbnailPendingPages.add(pageNumber)

  try {
    const page = await doc.getPage(pageNumber)

    if (!page.getViewport || !page.render) {
      return
    }

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = THUMBNAIL_PAPER_WIDTH / baseViewport.width
    const viewport = page.getViewport({ scale })
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio))

    await page.render({
      canvasContext: context,
      viewport,
      transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      background: 'rgb(255,255,255)'
    }).promise

    if (version === thumbnailRenderVersion) {
      thumbnailImageCache.set(pageNumber, canvas.toDataURL('image/png'))
      scheduleThumbnailRender()
    }

    page.cleanup?.()
  } catch {
    // 单个缩略图失败时保留占位，不影响主文档。
  } finally {
    thumbnailPendingPages.delete(pageNumber)
  }
}

function setupThumbnailResizeObserver() {
  thumbnailResizeObserver?.disconnect()

  if (!thumbnailScrollRef.value || typeof ResizeObserver === 'undefined') {
    return
  }

  thumbnailResizeObserver = new ResizeObserver(() => {
    updateThumbnailMetrics()
  })

  thumbnailResizeObserver.observe(thumbnailScrollRef.value)
}

function cleanupObservers() {
  resizeObserver?.disconnect()
  resizeObserver = null
  thumbnailResizeObserver?.disconnect()
  thumbnailResizeObserver = null
}

watch(thumbnailScrollRef, () => {
  setupThumbnailResizeObserver()
  updateThumbnailMetrics()
})

watch(isFullscreen, (locked) => {
  syncDocumentScrollLock(locked)
}, { immediate: true })

onBeforeUnmount(() => {
  cleanupObservers()
  destroyThumbnailLeafer()
  if (scrollLockApplied) {
    syncDocumentScrollLock(false)
  }
  window.clearTimeout(widthTimer)
  window.clearTimeout(scrollSyncTimer)
  window.cancelAnimationFrame(scrollFrame)
  window.cancelAnimationFrame(thumbnailFrame)
  window.cancelAnimationFrame(thumbnailMetricsFrame)
})
</script>

<template>
  <figure class="pdf-viewer" :class="{ 'is-fullscreen': isFullscreen }">
    <figcaption v-if="showTitle && title && !isFullscreen" class="pdf-viewer-title">{{ title }}</figcaption>

    <ClientOnly>
      <div class="pdf-viewer-shell" :style="{ height: isFullscreen ? '100vh' : `${height}px` }">
        <div class="pdf-viewer-body">
          <aside v-if="isSidebarOpen" class="pdf-viewer-sidebar">
            <div class="pdf-viewer-sidebar-header">
              <span>{{ sidebarTitle }}</span>
              <button type="button" aria-label="关闭侧栏" @click="isSidebarOpen = false">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
            </div>

            <div v-if="sidebarMode === 'outline'" class="pdf-viewer-outline">
              <div v-if="isOutlineLoading" class="pdf-viewer-sidebar-empty">
                <svg class="pdf-viewer-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="40 10"/>
                </svg>
                <span>目录加载中...</span>
              </div>
              <div v-else-if="!outline.length" class="pdf-viewer-sidebar-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5h10M9 9h10M9 13h10M5 5h.01M5 9h.01M5 13h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span>此 PDF 暂无目录</span>
              </div>
              <template v-else>
                <button
                  v-for="item in outline"
                  :key="item.id"
                  type="button"
                  class="pdf-viewer-outline-item"
                  :class="{ 'is-active': item.page === currentPage }"
                  :style="{ paddingLeft: `${12 + item.level * 16}px` }"
                  @click="openOutlineEntry(item)"
                >
                  <span>{{ item.title }}</span>
                  <small v-if="item.page">P{{ item.page }}</small>
                </button>
              </template>
            </div>

            <div
              v-else
              ref="thumbnailScrollRef"
              class="pdf-viewer-thumbnails"
              @scroll="scheduleThumbnailMetrics"
            >
              <div
                v-if="!thumbnailError"
                class="pdf-viewer-thumbnail-spacer"
                :style="{ height: `${thumbnailCanvasHeight}px` }"
              >
                <div
                  ref="thumbnailCanvasRef"
                  class="pdf-viewer-leafer-thumbnails"
                  :style="{
                    height: `${thumbnailViewportCanvasHeight}px`,
                    transform: `translate3d(0, ${thumbnailScrollTop}px, 0)`
                  }"
                />
              </div>
              <template v-else>
                <button
                  v-for="page in pageNumbers"
                  :key="page"
                  type="button"
                  class="pdf-viewer-thumbnail"
                  :class="{ 'is-active': page === currentPage }"
                  @click="goToPage(page)"
                >
                  <span>第 {{ page }} 页</span>
                </button>
              </template>
            </div>
          </aside>

          <div ref="stageRef" class="pdf-viewer-stage" @scroll="scheduleScrollMetrics">
            <div v-if="loadError" class="pdf-viewer-error">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
                <path d="M24 16v12M24 32v.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
              <span>{{ loadError }}</span>
            </div>
            <div v-else class="pdf-viewer-page-wrap">
              <VuePdfEmbed
                class="pdf-viewer-loader-document"
                :source="pdfSource"
                :page="1"
                :width="1"
                @loaded="handleLoaded"
                @loading-failed="setPdfError"
                @rendering-failed="setPdfError"
              />

              <div v-if="!pdfDoc" class="pdf-viewer-loading">
                <svg class="pdf-viewer-spinner" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="60 15"/>
                </svg>
                <span>PDF 加载中...</span>
              </div>

              <div
                v-else
                class="pdf-viewer-virtual-document"
                :style="{
                  width: `${appliedRenderWidth}px`,
                  height: `${totalDocumentHeight}px`
                }"
              >
                <div
                  v-for="page in virtualPages"
                  :key="`slot-${page}`"
                  class="pdf-viewer-virtual-page"
                  :data-page="page"
                  :style="{
                    width: `${appliedRenderWidth}px`,
                    height: `${pageHeight}px`,
                    transform: `translate3d(0, ${getPageTop(page)}px, 0)`
                  }"
                >
                  <VuePdfEmbed
                    annotation-layer
                    text-layer
                    class="pdf-viewer-document"
                    :key="`${pdfSource}-${renderKey}-${page}`"
                    :source="pdfDoc"
                    :page="page"
                    :width="appliedRenderWidth"
                    @internal-link-clicked="goToPage"
                    @loading-failed="setPdfError"
                    @rendering-failed="setPdfError"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pdf-viewer-toolbar">
          <div class="pdf-viewer-toolbar-group pdf-viewer-toolbar-start">
            <button
              type="button"
              class="pdf-viewer-icon-btn"
              :class="{ 'is-active': isSidebarOpen && sidebarMode === 'outline' }"
              title="文档目录"
              @click="toggleSidebar('outline')"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h10M2 14h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <button
              type="button"
              class="pdf-viewer-icon-btn"
              :class="{ 'is-active': isSidebarOpen && sidebarMode === 'thumbs' }"
              title="页面缩略图"
              @click="toggleSidebar('thumbs')"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5.5" height="6.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="10.5" y="2" width="5.5" height="6.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
            </button>
          </div>

          <div class="pdf-viewer-toolbar-group pdf-viewer-toolbar-center">
            <button type="button" class="pdf-viewer-icon-btn" :disabled="!canGoPrev" title="上一页 (←)" @click="goToPrevPage">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="pdf-viewer-page-indicator">
              <input
                v-model="pageInput"
                inputmode="numeric"
                :aria-label="`当前页，共 ${pageCount || 0} 页`"
                @blur="commitPageInput"
                @keydown="handlePageInputKeydown"
              />
              <span class="pdf-viewer-page-sep">/</span>
              <span class="pdf-viewer-page-total">{{ pageCount || '—' }}</span>
            </div>
            <button type="button" class="pdf-viewer-icon-btn" :disabled="!canGoNext" title="下一页 (→)" @click="goToNextPage">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            <span class="pdf-viewer-toolbar-divider" />

            <button type="button" class="pdf-viewer-icon-btn" :disabled="!canZoomOut" title="缩小 (-)" @click="zoomOut">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <select v-if="!isFullscreen" v-model="zoomValue" class="pdf-viewer-zoom-select" aria-label="缩放比例" title="缩放比例">
              <option value="auto">自动适应</option>
              <option v-if="!isPresetZoomSelected" :value="zoomValue">{{ zoomSelectLabel }}</option>
              <option value="0.25">25%</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="3">300%</option>
              <option value="4">400%</option>
              <option value="5">500%</option>
              <option value="7.5">750%</option>
              <option value="10">1000%</option>
            </select>
            <span v-else class="pdf-viewer-zoom-label" title="当前缩放比例">{{ zoomSelectLabel }}</span>
            <button type="button" class="pdf-viewer-icon-btn" :disabled="!canZoomIn" title="放大 (+)" @click="zoomIn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="pdf-viewer-icon-btn" title="重置缩放 (100%)" @click="resetZoom">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>
            </button>
          </div>

          <div class="pdf-viewer-toolbar-group pdf-viewer-toolbar-end">
            <button type="button" class="pdf-viewer-icon-btn" title="下载 PDF" @click="downloadPdf">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 12h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="pdf-viewer-icon-btn" title="打印" @click="printPdf">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 5V2h8v3M4 11H2V6h12v5h-2M4 9h8v5H4z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="pdf-viewer-icon-btn" :class="{ 'is-active': isFullscreen }" :title="isFullscreen ? '退出全屏' : '全屏显示'" @click="toggleFullscreen">
              <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M3 16v4a1 1 0 0 0 1 1h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3v5a1 1 0 0 1-1 1H3M15 3v5a1 1 0 0 0 1 1h5M9 21v-5a1 1 0 0 0-1-1H3M15 21v-5a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <a v-if="showOpenButton" class="pdf-viewer-icon-btn" :href="standaloneViewerUrl" target="_blank" rel="noopener noreferrer" title="新窗口打开">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 8v4a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 12V5a1.5 1.5 0 011.5-1.5h4M10 2h4v4M7 9l6.5-6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
        </div>
      </div>

      <template #fallback>
        <div class="pdf-viewer-fallback">
          <svg class="pdf-viewer-spinner" width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="60 15"/>
          </svg>
          <span>PDF 加载中...</span>
        </div>
      </template>
    </ClientOnly>
  </figure>
</template>
