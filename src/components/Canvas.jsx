import { useEffect, useRef } from 'react'
import p5 from 'p5'
import { createRadialGradient, createLinearGradient, createConicGradient } from '../lib/gradients'
import { applyDither } from '../lib/dithering'

function Canvas({ controls, sketchRef }) {
  const containerRef = useRef(null)
  const controlsRef = useRef(controls)
  const rotationRef = useRef(0)

  // Keep controls ref updated
  useEffect(() => {
    controlsRef.current = controls
  }, [controls])

  useEffect(() => {
    if (!containerRef.current) return

    const sketch = (p) => {
      let gradientBuffer
      let maskBuffer
      let compositeBuffer
      let outputBuffer
      const size = 600

      p.setup = () => {
        p.createCanvas(size, size)
        p.pixelDensity(1)

        // Buffer for the gradient
        gradientBuffer = p.createGraphics(size, size)
        gradientBuffer.pixelDensity(1)

        // Buffer for text mask (white text on black)
        maskBuffer = p.createGraphics(size, size)
        maskBuffer.pixelDensity(1)

        // Buffer for compositing gradient with mask
        compositeBuffer = p.createGraphics(size, size)
        compositeBuffer.pixelDensity(1)

        // Buffer for final output after dithering
        outputBuffer = p.createGraphics(size, size)
        outputBuffer.pixelDensity(1)
      }

      // Render text mask (white text on black background)
      const renderTextMask = (buffer, content, fontSize, fontFamily, w, h) => {
        buffer.background(0)
        buffer.fill(255)
        buffer.noStroke()
        buffer.textFont(fontFamily)
        buffer.textSize(fontSize)
        buffer.textAlign(p.CENTER, p.CENTER)
        buffer.text(content, w / 2, h / 2)
      }

      // Composite gradient through text mask
      const compositeGradientWithMask = (gradBuf, maskBuf, compBuf, bgColor) => {
        gradBuf.loadPixels()
        maskBuf.loadPixels()
        compBuf.loadPixels()

        // Parse background color
        const bg = hexToRgb(bgColor)

        for (let i = 0; i < gradBuf.pixels.length; i += 4) {
          // Mask value (0-255, white = show gradient, black = show background)
          const maskValue = maskBuf.pixels[i] / 255

          // Blend gradient with background based on mask
          compBuf.pixels[i] = Math.round(gradBuf.pixels[i] * maskValue + bg.r * (1 - maskValue))
          compBuf.pixels[i + 1] = Math.round(gradBuf.pixels[i + 1] * maskValue + bg.g * (1 - maskValue))
          compBuf.pixels[i + 2] = Math.round(gradBuf.pixels[i + 2] * maskValue + bg.b * (1 - maskValue))
          compBuf.pixels[i + 3] = 255
        }

        compBuf.updatePixels()
      }

      // Helper to parse hex color
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 }
      }

      p.draw = () => {
        const ctrl = controlsRef.current
        if (!ctrl) return

        // Leva returns flat controls, not nested in folders
        const content = ctrl.content
        const fontSize = ctrl.fontSize
        const fontFamily = ctrl.fontFamily
        const gradientType = ctrl.type
        const speed = ctrl.speed
        const playing = ctrl.playing
        const algorithm = ctrl.algorithm
        const strength = ctrl.strength
        const ditherSize = ctrl.size
        const colorLevels = ctrl.colorLevels
        const bgColor = ctrl.color

        // Extract colors dynamically by checking which color properties exist
        const colors = []
        for (let i = 1; i <= 8; i++) {
          if (ctrl[`color${i}`]) {
            colors.push(ctrl[`color${i}`])
          } else {
            break
          }
        }

        // Update rotation if playing
        if (playing) {
          rotationRef.current += speed * 0.02
        }

        // Step 1: Render gradient to buffer
        gradientBuffer.background(0)

        if (gradientType === 'radial') {
          createRadialGradient(gradientBuffer, size / 2, size / 2, colors, rotationRef.current, size)
        } else if (gradientType === 'linear') {
          createLinearGradient(gradientBuffer, colors, rotationRef.current, size)
        } else if (gradientType === 'conic') {
          createConicGradient(gradientBuffer, size / 2, size / 2, colors, rotationRef.current, size)
        }

        // Step 2: Render text mask
        renderTextMask(maskBuffer, content, fontSize, fontFamily, size, size)

        // Step 3: Composite gradient through text mask
        compositeGradientWithMask(gradientBuffer, maskBuffer, compositeBuffer, bgColor)

        // Step 4: Apply dithering
        compositeBuffer.loadPixels()
        const ditheredPixels = applyDither(
          compositeBuffer.pixels,
          size,
          size,
          algorithm,
          strength,
          ditherSize,
          colorLevels
        )

        // Step 5: Copy to output buffer
        outputBuffer.loadPixels()
        for (let i = 0; i < ditheredPixels.length; i++) {
          outputBuffer.pixels[i] = ditheredPixels[i]
        }
        outputBuffer.updatePixels()

        // Draw to main canvas
        p.image(outputBuffer, 0, 0)
      }

      // Expose render function for export at different resolutions
      p.renderAtSize = (width, height) => {
        const ctrl = controlsRef.current
        if (!ctrl) return null

        const content = ctrl.content
        const fontSize = ctrl.fontSize
        const fontFamily = ctrl.fontFamily
        const gradientType = ctrl.type
        const algorithm = ctrl.algorithm
        const strength = ctrl.strength
        const ditherSize = ctrl.size
        const colorLevels = ctrl.colorLevels
        const bgColor = ctrl.color

        // Extract colors dynamically by checking which color properties exist
        const colors = []
        for (let i = 1; i <= 8; i++) {
          if (ctrl[`color${i}`]) {
            colors.push(ctrl[`color${i}`])
          } else {
            break
          }
        }

        // Create buffers at export size
        const gradBuf = p.createGraphics(width, height)
        gradBuf.pixelDensity(1)
        const maskBuf = p.createGraphics(width, height)
        maskBuf.pixelDensity(1)
        const compBuf = p.createGraphics(width, height)
        compBuf.pixelDensity(1)

        // Render gradient
        if (gradientType === 'radial') {
          createRadialGradient(gradBuf, width / 2, height / 2, colors, rotationRef.current, Math.max(width, height))
        } else if (gradientType === 'linear') {
          createLinearGradient(gradBuf, colors, rotationRef.current, Math.max(width, height))
        } else if (gradientType === 'conic') {
          createConicGradient(gradBuf, width / 2, height / 2, colors, rotationRef.current, Math.max(width, height))
        }

        // Render text mask at scaled font size
        const scaledFontSize = fontSize * (Math.min(width, height) / size)
        renderTextMask(maskBuf, content, scaledFontSize, fontFamily, width, height)

        // Composite
        compositeGradientWithMask(gradBuf, maskBuf, compBuf, bgColor)

        // Apply dithering
        compBuf.loadPixels()
        const ditheredPixels = applyDither(
          compBuf.pixels,
          width,
          height,
          algorithm,
          strength,
          ditherSize,
          colorLevels
        )

        for (let i = 0; i < ditheredPixels.length; i++) {
          compBuf.pixels[i] = ditheredPixels[i]
        }
        compBuf.updatePixels()

        // Cleanup temp buffers
        gradBuf.remove()
        maskBuf.remove()

        return compBuf
      }

      // Expose step function for animation during export
      p.stepAnimation = (delta) => {
        const ctrl = controlsRef.current
        if (ctrl?.playing) {
          rotationRef.current += ctrl.speed * 0.02 * delta
        }
      }

      p.getRotation = () => rotationRef.current
      p.setRotation = (r) => { rotationRef.current = r }
    }

    const p5Instance = new p5(sketch, containerRef.current)
    sketchRef.current = p5Instance

    return () => {
      p5Instance.remove()
    }
  }, [])

  return <div ref={containerRef} />
}

export default Canvas
