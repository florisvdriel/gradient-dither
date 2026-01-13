import { useControls, folder, button, Leva } from 'leva'
import { useState, useCallback, useRef } from 'react'
import Canvas from './components/Canvas'
import { exportPNG, exportGIF, exportMP4 } from './lib/exporter'

const DEFAULT_COLORS = {
  color1: '#ff6b6b', // Warm red
  color2: '#4ecdc4', // Teal
  color3: '#45b7d1', // Sky blue
  color4: '#f7b731', // Golden yellow
  color5: '#5f27cd', // Deep purple
  color6: '#00d2d3', // Bright cyan
  color7: '#ee5a6f', // Coral pink
  color8: '#2d98da', // Ocean blue
}

function App() {
  const [numColors, setNumColors] = useState(3)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState('')
  const canvasRef = useRef(null)
  const sketchRef = useRef(null)

  const handleExport = useCallback(async () => {
    if (!sketchRef.current) return

    setExporting(true)
    setExportProgress(0)

    try {
      const { format, resolution, fps, duration } = controls.Export
      const width = resolution === '1080p' ? 1920 : 1280
      const height = resolution === '1080p' ? 1080 : 720

      if (format === 'png') {
        setExportStatus('Capturing frame...')
        await exportPNG(sketchRef.current, width, height)
      } else if (format === 'gif') {
        setExportStatus('Creating GIF...')
        await exportGIF(sketchRef.current, width, height, duration, (p) => setExportProgress(p))
      } else if (format === 'mp4') {
        setExportStatus('Encoding MP4...')
        await exportMP4(sketchRef.current, width, height, fps, duration, (p, s) => {
          setExportProgress(p)
          if (s) setExportStatus(s)
        })
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }, [])

  const controls = useControls({
    Text: folder({
      content: { value: 'DITHER', label: 'Text' },
      fontSize: { value: 120, min: 20, max: 300, step: 10 },
      fontFamily: { value: 'Impact', options: ['Impact', 'Arial Black', 'Georgia', 'Times New Roman', 'Courier New', 'Comic Sans MS'] },
    }),
    Gradient: folder({
      type: { value: 'radial', options: ['radial', 'linear', 'conic'] },
      color1: DEFAULT_COLORS.color1,
      color2: DEFAULT_COLORS.color2,
      color3: DEFAULT_COLORS.color3,
      color4: { value: DEFAULT_COLORS.color4, render: (get) => numColors >= 4 },
      color5: { value: DEFAULT_COLORS.color5, render: (get) => numColors >= 5 },
      color6: { value: DEFAULT_COLORS.color6, render: (get) => numColors >= 6 },
      color7: { value: DEFAULT_COLORS.color7, render: (get) => numColors >= 7 },
      color8: { value: DEFAULT_COLORS.color8, render: (get) => numColors >= 8 },
      '+ Add Color': button(() => setNumColors(Math.min(numColors + 1, 8)), { disabled: numColors >= 8 }),
      '- Remove Color': button(() => setNumColors(Math.max(numColors - 1, 3)), { disabled: numColors <= 3 }),
      speed: { value: 1, min: 0, max: 5, step: 0.1 },
      playing: true,
    }),
    Dither: folder({
      algorithm: { value: 'bayer', options: ['bayer', 'floyd-steinberg', 'atkinson', 'random'] },
      strength: { value: 0.5, min: 0, max: 1, step: 0.01 },
      size: { value: 4, min: 1, max: 16, step: 1 },
      colorLevels: { value: 4, min: 2, max: 32, step: 1 },
    }),
    Background: folder({
      color: '#000000',
    }),
    Export: folder({
      format: { value: 'mp4', options: ['mp4', 'gif', 'png'] },
      resolution: { value: '1080p', options: ['720p', '1080p'] },
      fps: { value: 60, min: 24, max: 60, step: 1 },
      duration: { value: 3, min: 1, max: 10, step: 0.5 },
      'Export': button(() => handleExport()),
    }),
  }, [numColors])

  return (
    <div className="app">
      <Leva collapsed={false} />
      <div className="canvas-container" ref={canvasRef}>
        <Canvas controls={controls} sketchRef={sketchRef} />
      </div>

      {exporting && (
        <div className="export-overlay">
          <h2>{exportStatus}</h2>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${exportProgress * 100}%` }}
            />
          </div>
          <div className="progress-text">{Math.round(exportProgress * 100)}%</div>
        </div>
      )}
    </div>
  )
}

export default App
