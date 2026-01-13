/**
 * Gradient generators for p5.js graphics contexts
 */

/**
 * Parse hex color to RGB object
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

/**
 * Interpolate between colors based on t (0-1)
 */
function lerpColors(colors, t) {
  const rgbColors = colors.map(hexToRgb)
  const segments = rgbColors.length - 1
  const segment = Math.min(Math.floor(t * segments), segments - 1)
  const localT = (t * segments) - segment

  const c1 = rgbColors[segment]
  const c2 = rgbColors[segment + 1]

  return {
    r: Math.round(c1.r + (c2.r - c1.r) * localT),
    g: Math.round(c1.g + (c2.g - c1.g) * localT),
    b: Math.round(c1.b + (c2.b - c1.b) * localT)
  }
}

/**
 * Create a radial gradient
 * Smooth circular fade from center to edge
 */
export function createRadialGradient(g, cx, cy, colors, rotation, size) {
  g.loadPixels()
  const d = g.pixelDensity()
  const w = g.width * d
  const h = g.height * d

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx * d
      const dy = y - cy * d

      // Calculate distance from center
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxDist = size * d * 0.5

      // Normalize distance to 0-1 (center to edge)
      let t = Math.min(dist / maxDist, 1)

      // Add rotation offset to cycle colors
      const rotationOffset = (rotation / (2 * Math.PI)) % 1
      t = (t + rotationOffset) % 1

      // Handle negative wrapping
      if (t < 0) t += 1

      const color = lerpColors(colors, t)

      const idx = 4 * (y * w + x)
      g.pixels[idx] = color.r
      g.pixels[idx + 1] = color.g
      g.pixels[idx + 2] = color.b
      g.pixels[idx + 3] = 255
    }
  }
  g.updatePixels()
}

/**
 * Create a rotating linear gradient
 */
export function createLinearGradient(g, colors, rotation, size) {
  g.loadPixels()
  const d = g.pixelDensity()
  const w = g.width * d
  const h = g.height * d
  const cx = w / 2
  const cy = h / 2

  // Direction vector based on rotation
  const dirX = Math.cos(rotation)
  const dirY = Math.sin(rotation)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Project point onto gradient direction
      const dx = x - cx
      const dy = y - cy
      const proj = dx * dirX + dy * dirY

      // Normalize to 0-1 based on size
      const maxProj = size * d * 0.5
      let t = (proj + maxProj) / (2 * maxProj)
      t = Math.max(0, Math.min(1, t))

      const color = lerpColors(colors, t)

      const idx = 4 * (y * w + x)
      g.pixels[idx] = color.r
      g.pixels[idx + 1] = color.g
      g.pixels[idx + 2] = color.b
      g.pixels[idx + 3] = 255
    }
  }
  g.updatePixels()
}

/**
 * Create a rotating conic/angular gradient
 * Colors sweep around the center point
 */
export function createConicGradient(g, cx, cy, colors, rotation, size) {
  g.loadPixels()
  const d = g.pixelDensity()
  const w = g.width * d
  const h = g.height * d

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx * d
      const dy = y - cy * d
      let angle = Math.atan2(dy, dx)

      // Add rotation
      angle += rotation

      // Normalize to 0-1
      let t = (angle + Math.PI) / (2 * Math.PI)
      t = t % 1
      if (t < 0) t += 1

      const color = lerpColors(colors, t)

      const idx = 4 * (y * w + x)
      g.pixels[idx] = color.r
      g.pixels[idx + 1] = color.g
      g.pixels[idx + 2] = color.b
      g.pixels[idx + 3] = 255
    }
  }
  g.updatePixels()
}
