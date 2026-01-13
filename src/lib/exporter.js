/**
 * Export functionality for PNG, GIF, and MP4
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance = null
let ffmpegLoading = false

/**
 * Get or create FFmpeg instance (lazy loaded)
 */
async function getFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance

  if (ffmpegLoading) {
    // Wait for existing load
    while (ffmpegLoading) {
      await new Promise(r => setTimeout(r, 100))
    }
    return ffmpegInstance
  }

  ffmpegLoading = true
  onProgress?.(0, 'Loading FFmpeg...')

  const ffmpeg = new FFmpeg()

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(progress, 'Encoding...')
  })

  // Load ffmpeg core
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpegInstance = ffmpeg
  ffmpegLoading = false

  return ffmpeg
}

/**
 * Export single frame as PNG
 */
export async function exportPNG(sketch, width, height) {
  const buffer = sketch.renderAtSize(width, height)
  if (!buffer) throw new Error('Failed to render frame')

  // Get canvas from p5 graphics
  const canvas = buffer.canvas || buffer.elt

  // Create download link
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = `gradient-dither-${Date.now()}.png`
  link.href = dataUrl
  link.click()

  buffer.remove()
}

/**
 * Export animation as GIF
 */
export async function exportGIF(sketch, width, height, duration, onProgress) {
  // Dynamic import gif.js (it's a bit quirky with ESM)
  const GIF = (await import('gif.js')).default

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      workerScript: 'https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js'
    })

    const fps = 30
    const totalFrames = Math.ceil(duration * fps)
    const frameDelay = 1000 / fps

    // Save current rotation to restore after
    const startRotation = sketch.getRotation()

    for (let i = 0; i < totalFrames; i++) {
      onProgress?.(i / totalFrames)

      const buffer = sketch.renderAtSize(width, height)
      if (!buffer) continue

      const canvas = buffer.canvas || buffer.elt

      // Create a regular canvas copy (gif.js needs regular canvas)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width
      tempCanvas.height = height
      const ctx = tempCanvas.getContext('2d')
      ctx.drawImage(canvas, 0, 0)

      gif.addFrame(tempCanvas, { delay: frameDelay, copy: true })

      buffer.remove()

      // Step animation forward
      sketch.stepAnimation(1)
    }

    // Restore rotation
    sketch.setRotation(startRotation)

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `gradient-dither-${Date.now()}.gif`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
      resolve()
    })

    gif.on('error', reject)

    onProgress?.(0.9, 'Encoding GIF...')
    gif.render()
  })
}

/**
 * Export animation as MP4 (H.264)
 */
export async function exportMP4(sketch, width, height, fps, duration, onProgress) {
  const ffmpeg = await getFFmpeg(onProgress)

  const totalFrames = Math.ceil(duration * fps)
  const startRotation = sketch.getRotation()

  onProgress?.(0, 'Capturing frames...')

  // Capture all frames
  for (let i = 0; i < totalFrames; i++) {
    onProgress?.(i / totalFrames * 0.5, `Capturing frame ${i + 1}/${totalFrames}`)

    const buffer = sketch.renderAtSize(width, height)
    if (!buffer) continue

    const canvas = buffer.canvas || buffer.elt

    // Convert canvas to blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const arrayBuffer = await blob.arrayBuffer()

    // Write frame to ffmpeg filesystem
    const frameNum = String(i).padStart(5, '0')
    await ffmpeg.writeFile(`frame${frameNum}.png`, new Uint8Array(arrayBuffer))

    buffer.remove()

    // Step animation
    sketch.stepAnimation(1)
  }

  // Restore rotation
  sketch.setRotation(startRotation)

  onProgress?.(0.5, 'Encoding MP4...')

  // Encode to MP4
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%05d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    'output.mp4'
  ])

  onProgress?.(0.95, 'Preparing download...')

  // Read output file
  const data = await ffmpeg.readFile('output.mp4')

  // Clean up frames
  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(5, '0')
    await ffmpeg.deleteFile(`frame${frameNum}.png`).catch(() => {})
  }
  await ffmpeg.deleteFile('output.mp4').catch(() => {})

  // Download
  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `gradient-dither-${Date.now()}.mp4`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)

  onProgress?.(1, 'Complete!')
}
