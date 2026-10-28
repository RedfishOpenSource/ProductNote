/**
 * 抽帧相似度去重(纯离线):dHash 差异哈希(9×8 = 64 bit)。
 * 两帧汉明距离越小越相似;距离 >= 阈值视为"画面变化大",即新商品候选帧。
 */

const HASH_WIDTH = 9
const HASH_HEIGHT = 8

/** 从已绘制的 canvas 计算 dHash(十六进制字符串) */
export function computeDHashFromCanvas(canvas: HTMLCanvasElement): string {
  const small = document.createElement('canvas')
  small.width = HASH_WIDTH
  small.height = HASH_HEIGHT
  const context = small.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('当前环境不支持图像哈希')
  }

  context.drawImage(canvas, 0, 0, HASH_WIDTH, HASH_HEIGHT)
  const data = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT).data

  const gray: number[] = []
  for (let index = 0; index < HASH_WIDTH * HASH_HEIGHT; index += 1) {
    const offset = index * 4
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    gray.push(red * 0.299 + green * 0.587 + blue * 0.114)
  }

  let bits = ''
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const left = gray[y * HASH_WIDTH + x]
      const right = gray[y * HASH_WIDTH + x + 1]
      bits += left < right ? '1' : '0'
    }
  }

  return bitsToHex(bits)
}

/** 两帧哈希的汉明距离(0 = 完全相同,64 = 完全不同) */
export function hammingDistanceHex(left: string, right: string): number {
  if (left.length !== right.length) {
    return 64
  }

  let distance = 0
  for (let index = 0; index < left.length; index += 1) {
    const diff = parseInt(left.charAt(index), 16) ^ parseInt(right.charAt(index), 16)
    distance += popcount4(diff)
  }
  return distance
}

function popcount4(value: number): number {
  let count = 0
  let current = value & 0xf
  while (current) {
    count += current & 1
    current >>= 1
  }
  return count
}

function bitsToHex(bits: string): string {
  let hex = ''
  for (let index = 0; index < bits.length; index += 4) {
    hex += parseInt(bits.slice(index, index + 4), 2).toString(16)
  }
  return hex
}
