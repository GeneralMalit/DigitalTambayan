import { useState, useRef, useEffect } from 'react'
import { UI_STRINGS } from '@/config/uiStrings'

interface ImageCropModalProps {
    imageFile: File
    onCrop: (blob: Blob) => void
    onClose: () => void
}

export default function ImageCropModal({ imageFile, onCrop, onClose }: ImageCropModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [img, setImg] = useState<HTMLImageElement | null>(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [loading, setLoading] = useState(false)

    // Load image on mount
    useEffect(() => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const image = new Image()
            image.src = e.target?.result as string
            image.onload = () => {
                setImg(image)
                // Initial zoom to fit
                const initialZoom = Math.max(300 / image.width, 300 / image.height)
                setZoom(initialZoom)
            }
        }
        reader.readAsDataURL(imageFile)
    }, [imageFile])

    // Draw preview
    useEffect(() => {
        if (!img || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw image
        const drawWidth = img.width * zoom
        const drawHeight = img.height * zoom
        ctx.drawImage(img, offset.x, offset.y, drawWidth, drawHeight)

        // Draw circular overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.beginPath()
        ctx.rect(0, 0, canvas.width, canvas.height)
        ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2, true)
        ctx.fill()

        // Draw circle border
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2)
        ctx.stroke()
    }, [img, offset, zoom])

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleSave = async () => {
        if (!img) return
        setLoading(true)

        try {
            const finalCanvas = document.createElement('canvas')
            finalCanvas.width = 200
            finalCanvas.height = 200
            const ctx = finalCanvas.getContext('2d')
            if (!ctx) throw new Error('Canvas context failed')

            // Calculate crop area based on 300x300 preview vs 200x200 final
            // Preview center is 150, 150. Circle radius is 100.
            // Image is drawn at offset.x, offset.y with size img.width * zoom

            // Map the 300x300 preview onto the final 200x200
            // Scale factor is 2/3
            const scale = 200 / 300
            const finalZoom = zoom * scale
            const finalOffsetX = (offset.x - 50) * scale // Adj for 300->200?

            // Precise math:
            // Preview circle center: (150, 150) in 300x300
            // Final circle center: (100, 100) in 200x200
            // offset.x is the position of img top-left relative to preview (0,0)
            // So img top-left relative to preview center is (offset.x - 150, offset.y - 150)
            // In final (200x200), that same relative distance is (offset.x - 150) * (200/300), (offset.y - 150) * (200/300)
            // So top-left in final is (offset.x - 150) * (200/300) + 100

            const ratio = 200 / 300
            const targetX = (offset.x - 150) * ratio + 100
            const targetY = (offset.y - 150) * ratio + 100
            const targetW = img.width * zoom * ratio
            const targetH = img.height * zoom * ratio

            ctx.drawImage(img, targetX, targetY, targetW, targetH)

            finalCanvas.toBlob((blob) => {
                if (blob) {
                    onCrop(blob)
                }
                setLoading(false)
            }, 'image/jpeg', 0.9)
        } catch (err) {
            console.error('Crop failed:', err)
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{UI_STRINGS.photos.cropTitle}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-xs text-zinc-500 italic">
                        {UI_STRINGS.photos.cropInstructions}
                    </p>

                    <div className="relative flex justify-center">
                        <canvas
                            ref={canvasRef}
                            width={300}
                            height={300}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className="bg-black border border-white/5 rounded-lg cursor-move touch-none"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-400">Zoom</span>
                            <span className="text-xs text-zinc-500">{(zoom * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-all"
                        >
                            {UI_STRINGS.common.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                        >
                            {loading ? UI_STRINGS.photos.uploading : UI_STRINGS.common.upload}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
