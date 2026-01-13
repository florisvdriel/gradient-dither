/**
 * Dithering algorithms with size control
 */

// Bayer matrices for ordered dithering
const BAYER_2 = [
  [0, 2],
  [3, 1]
]

const BAYER_4 = [
  [0,  8,  2,  10],
  [12, 4,  14, 6],
  [3,  11, 1,  9],
  [15, 7,  13, 5]
]

const BAYER_8 = [
  [0,  32, 8,  40, 2,  34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4,  36, 14, 46, 6,  38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3,  35, 11, 43, 1,  33, 9,  41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7,  39, 13, 45, 5,  37],
  [63, 31, 55, 23, 61, 29, 53, 21]
]

const BAYER_16 = generateBayerMatrix(16)

function generateBayerMatrix(size) {
  if (size === 2) return BAYER_2

  const half = size / 2
  const smaller = generateBayerMatrix(half)
  const matrix = []

  for (let y = 0; y < size; y++) {
    matrix[y] = []
    for (let x = 0; x < size; x++) {
      const sy = y % half
      const sx = x % half
      const quadrant = (Math.floor(y / half) * 2 + Math.floor(x / half))
      const offsets = [0, 2, 3, 1]
      matrix[y][x] = 4 * smaller[sy][sx] + offsets[quadrant]
    }
  }

  return matrix
}

function getBayerMatrix(size) {
  if (size <= 2) return { matrix: BAYER_2, size: 2, max: 4 }
  if (size <= 4) return { matrix: BAYER_4, size: 4, max: 16 }
  if (size <= 8) return { matrix: BAYER_8, size: 8, max: 64 }
  return { matrix: BAYER_16, size: 16, max: 256 }
}

/**
 * Quantize a value to N levels
 */
function quantize(value, levels) {
  const step = 255 / (levels - 1)
  return Math.round(Math.round(value / step) * step)
}

/**
 * Bayer ordered dithering
 */
function bayerDither(pixels, width, height, strength, size, colorLevels) {
  const output = new Uint8ClampedArray(pixels)
  const { matrix, size: matrixSize, max } = getBayerMatrix(size)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = 4 * (y * width + x)

      // Get threshold from Bayer matrix
      const mx = x % matrixSize
      const my = y % matrixSize
      const threshold = (matrix[my][mx] / max - 0.5) * strength * 255

      for (let c = 0; c < 3; c++) {
        let value = pixels[idx + c] + threshold
        value = Math.max(0, Math.min(255, value))
        output[idx + c] = quantize(value, colorLevels)
      }
    }
  }

  return output
}

/**
 * Floyd-Steinberg error diffusion dithering with scale
 */
function floydSteinbergDither(pixels, width, height, strength, scale, colorLevels) {
  // Downsample for chunky effect
  const scaledWidth = Math.floor(width / scale)
  const scaledHeight = Math.floor(height / scale)

  // Create scaled down version
  const scaled = new Float32Array(scaledWidth * scaledHeight * 4)

  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const srcX = x * scale
      const srcY = y * scale
      const srcIdx = 4 * (srcY * width + srcX)
      const dstIdx = 4 * (y * scaledWidth + x)

      scaled[dstIdx] = pixels[srcIdx]
      scaled[dstIdx + 1] = pixels[srcIdx + 1]
      scaled[dstIdx + 2] = pixels[srcIdx + 2]
      scaled[dstIdx + 3] = 255
    }
  }

  // Apply Floyd-Steinberg at scaled resolution
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const idx = 4 * (y * scaledWidth + x)

      for (let c = 0; c < 3; c++) {
        const oldValue = scaled[idx + c]
        const newValue = quantize(oldValue, colorLevels)
        scaled[idx + c] = newValue

        const error = (oldValue - newValue) * strength

        // Distribute error to neighbors
        if (x + 1 < scaledWidth) {
          scaled[idx + 4 + c] += error * 7 / 16
        }
        if (y + 1 < scaledHeight) {
          if (x > 0) {
            scaled[idx + scaledWidth * 4 - 4 + c] += error * 3 / 16
          }
          scaled[idx + scaledWidth * 4 + c] += error * 5 / 16
          if (x + 1 < scaledWidth) {
            scaled[idx + scaledWidth * 4 + 4 + c] += error * 1 / 16
          }
        }
      }
    }
  }

  // Upscale back with nearest neighbor
  const output = new Uint8ClampedArray(pixels.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(Math.floor(x / scale), scaledWidth - 1)
      const srcY = Math.min(Math.floor(y / scale), scaledHeight - 1)
      const srcIdx = 4 * (srcY * scaledWidth + srcX)
      const dstIdx = 4 * (y * width + x)

      output[dstIdx] = Math.max(0, Math.min(255, scaled[srcIdx]))
      output[dstIdx + 1] = Math.max(0, Math.min(255, scaled[srcIdx + 1]))
      output[dstIdx + 2] = Math.max(0, Math.min(255, scaled[srcIdx + 2]))
      output[dstIdx + 3] = 255
    }
  }

  return output
}

/**
 * Atkinson dithering (Mac-style, preserves highlights)
 */
function atkinsonDither(pixels, width, height, strength, scale, colorLevels) {
  const scaledWidth = Math.floor(width / scale)
  const scaledHeight = Math.floor(height / scale)

  const scaled = new Float32Array(scaledWidth * scaledHeight * 4)

  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const srcX = x * scale
      const srcY = y * scale
      const srcIdx = 4 * (srcY * width + srcX)
      const dstIdx = 4 * (y * scaledWidth + x)

      scaled[dstIdx] = pixels[srcIdx]
      scaled[dstIdx + 1] = pixels[srcIdx + 1]
      scaled[dstIdx + 2] = pixels[srcIdx + 2]
      scaled[dstIdx + 3] = 255
    }
  }

  // Atkinson distributes only 3/4 of error (preserves highlights/shadows)
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const idx = 4 * (y * scaledWidth + x)

      for (let c = 0; c < 3; c++) {
        const oldValue = scaled[idx + c]
        const newValue = quantize(oldValue, colorLevels)
        scaled[idx + c] = newValue

        // Atkinson only distributes 3/4 of error (6/8)
        const error = (oldValue - newValue) * strength / 8

        // Distribution pattern (each gets 1/8 of error)
        if (x + 1 < scaledWidth) scaled[idx + 4 + c] += error
        if (x + 2 < scaledWidth) scaled[idx + 8 + c] += error

        if (y + 1 < scaledHeight) {
          if (x > 0) scaled[idx + scaledWidth * 4 - 4 + c] += error
          scaled[idx + scaledWidth * 4 + c] += error
          if (x + 1 < scaledWidth) scaled[idx + scaledWidth * 4 + 4 + c] += error
        }

        if (y + 2 < scaledHeight) {
          scaled[idx + scaledWidth * 8 + c] += error
        }
      }
    }
  }

  // Upscale
  const output = new Uint8ClampedArray(pixels.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(Math.floor(x / scale), scaledWidth - 1)
      const srcY = Math.min(Math.floor(y / scale), scaledHeight - 1)
      const srcIdx = 4 * (srcY * scaledWidth + srcX)
      const dstIdx = 4 * (y * width + x)

      output[dstIdx] = Math.max(0, Math.min(255, scaled[srcIdx]))
      output[dstIdx + 1] = Math.max(0, Math.min(255, scaled[srcIdx + 1]))
      output[dstIdx + 2] = Math.max(0, Math.min(255, scaled[srcIdx + 2]))
      output[dstIdx + 3] = 255
    }
  }

  return output
}

/**
 * Random/noise dithering with grain size
 */
function randomDither(pixels, width, height, strength, grainSize, colorLevels) {
  const output = new Uint8ClampedArray(pixels)

  // Create noise at grain resolution
  const noiseWidth = Math.ceil(width / grainSize)
  const noiseHeight = Math.ceil(height / grainSize)
  const noise = new Float32Array(noiseWidth * noiseHeight)

  for (let i = 0; i < noise.length; i++) {
    noise[i] = (Math.random() - 0.5) * strength * 255
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = 4 * (y * width + x)

      // Get noise value for this grain
      const nx = Math.floor(x / grainSize)
      const ny = Math.floor(y / grainSize)
      const noiseVal = noise[ny * noiseWidth + nx]

      for (let c = 0; c < 3; c++) {
        let value = pixels[idx + c] + noiseVal
        value = Math.max(0, Math.min(255, value))
        output[idx + c] = quantize(value, colorLevels)
      }
    }
  }

  return output
}

/**
 * Main dithering function - dispatches to correct algorithm
 */
export function applyDither(pixels, width, height, algorithm, strength, size, colorLevels) {
  switch (algorithm) {
    case 'bayer':
      return bayerDither(pixels, width, height, strength, size, colorLevels)
    case 'floyd-steinberg':
      return floydSteinbergDither(pixels, width, height, strength, Math.max(1, size), colorLevels)
    case 'atkinson':
      return atkinsonDither(pixels, width, height, strength, Math.max(1, size), colorLevels)
    case 'random':
      return randomDither(pixels, width, height, strength, Math.max(1, size), colorLevels)
    default:
      return new Uint8ClampedArray(pixels)
  }
}
