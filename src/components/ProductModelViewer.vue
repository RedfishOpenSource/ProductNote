<template>
  <div class="model-viewer-shell">
    <div ref="containerRef" class="model-viewer-canvas" />
    <div v-if="loading" class="model-viewer-overlay">正在加载 3D 模型...</div>
    <div v-else-if="errorMessage" class="model-viewer-overlay model-viewer-overlay-error">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  src: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMessage = ref('')

let renderer: WebGLRenderer | null = null
let camera: PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let scene: Scene | null = null
let frameId = 0
let currentModel: Group | null = null
let resizeObserver: ResizeObserver | null = null

function clearRenderer(): void {
  if (frameId) {
    cancelAnimationFrame(frameId)
    frameId = 0
  }

  controls?.dispose()
  controls = null

  renderer?.dispose()
  renderer = null

  currentModel = null
  camera = null
  scene = null

  resizeObserver?.disconnect()
  resizeObserver = null

  const container = containerRef.value
  if (container) {
    container.innerHTML = ''
  }
}

function fitCameraToObject(model: Group): void {
  if (!camera || !controls) return

  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxSize = Math.max(size.x, size.y, size.z, 1)
  const distance = maxSize * 1.8

  camera.position.set(center.x + distance * 0.8, center.y + distance * 0.6, center.z + distance)
  camera.near = 0.01
  camera.far = distance * 10
  camera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.update()
}

function updateRendererSize(): void {
  const container = containerRef.value
  if (!container || !renderer || !camera) return

  const width = container.clientWidth || 1
  const height = container.clientHeight || 1
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate(): void {
  if (!renderer || !scene || !camera) return
  frameId = requestAnimationFrame(animate)
  controls?.update()
  renderer.render(scene, camera)
}

async function initializeViewer(): Promise<void> {
  const container = containerRef.value
  if (!container || !props.src) {
    errorMessage.value = '没有可显示的 3D 模型'
    loading.value = false
    return
  }

  clearRenderer()
  await nextTick()

  const freshContainer = containerRef.value
  if (!freshContainer) return

  loading.value = true
  errorMessage.value = ''

  scene = new Scene()
  scene.background = new Color('#f3f5f9')

  camera = new PerspectiveCamera(45, 1, 0.01, 100)
  renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(window.devicePixelRatio)
  freshContainer.appendChild(renderer.domElement)

  const ambientLight = new AmbientLight('#ffffff', 1.2)
  const directionalLight = new DirectionalLight('#ffffff', 1.4)
  directionalLight.position.set(4, 6, 8)
  scene.add(ambientLight, directionalLight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 0.5
  controls.maxDistance = 12

  updateRendererSize()

  const loader = new GLTFLoader()

  try {
    const gltf = await loader.loadAsync(props.src)
    currentModel = gltf.scene
    scene.add(currentModel)
    fitCameraToObject(currentModel)
    resizeObserver = new ResizeObserver(() => updateRendererSize())
    resizeObserver.observe(freshContainer)
    loading.value = false
    animate()
  } catch (error) {
    console.error(error)
    errorMessage.value = '3D 模型加载失败'
    loading.value = false
  }
}

watch(
  () => props.src,
  () => {
    void initializeViewer()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearRenderer()
})
</script>

<style scoped>
.model-viewer-shell {
  position: relative;
  min-height: 320px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(180deg, #f8faff 0%, #eef2f8 100%);
}

.model-viewer-canvas {
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.model-viewer-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--app-title);
  font-size: 14px;
  text-align: center;
  background: rgba(248, 250, 255, 0.72);
  backdrop-filter: blur(4px);
}

.model-viewer-overlay-error {
  color: var(--app-danger);
}
</style>
