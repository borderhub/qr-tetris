'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Box, Button } from '@mui/material'
import QrCode from '@mui/icons-material/QrCode'
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import PlaceIcon from '@mui/icons-material/Place'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Summarize from '@mui/icons-material/Summarize'
import AttachFile from '@mui/icons-material/AttachFile'
import Clear from '@mui/icons-material/Clear'
import jsQR from 'jsqr' // ★ 変更点 1: jsqrライブラリをインポート

// テトリスピースの定義
const TETRIS_PIECES = [
  // I-piece
  {
    shape: [[1, 1, 1, 1]],
    color: [0, 255, 255]
  },
  // O-piece
  {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: [255, 255, 0]
  },
  // T-piece
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1]
    ],
    color: [128, 0, 128]
  },
  // S-piece
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0]
    ],
    color: [0, 255, 0]
  },
  // Z-piece
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1]
    ],
    color: [255, 0, 0]
  },
  // J-piece
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1]
    ],
    color: [0, 0, 255]
  },
  // L-piece
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1]
    ],
    color: [255, 165, 0]
  }
]

interface GamePiece {
  x: number
  y: number
  shape: number[][]
  color: number[]
  width: number
  height: number
}

export default function QRTetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationFrameRef = useRef<number>(0)
  
  const [qrData, setQrData] = useState<number[][]>([])
  const [gameGrid, setGameGrid] = useState<number[][]>([])
  const [currentPiece, setCurrentPiece] = useState<GamePiece | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [gameCompleted, setGameCompleted] = useState(false)
  const [placedBlocks, setPlacedBlocks] = useState(0)
  const [totalBlocks, setTotalBlocks] = useState(0)
  const [dropTimer, setDropTimer] = useState(0)
  const [gameWidth, setGameWidth] = useState(0)
  const [gameHeight, setGameHeight] = useState(0)
  const [cellSize, setCellSize] = useState(20)
  const [isMobile, setIsMobile] = useState(false)
  
  const dropInterval = 60

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const calculateCellSize = useCallback(() => {
    if (!gameWidth || !gameHeight) return 20

    const windowWidth = window.innerWidth
    const maxCanvasWidth = windowWidth * 0.8
    const maxCanvasHeight = window.innerHeight * 0.6

    const cellSizeByWidth = maxCanvasWidth / gameWidth
    const cellSizeByHeight = maxCanvasHeight / gameHeight
    const newCellSize = Math.min(cellSizeByWidth, cellSizeByHeight, 30)
    return Math.max(8, Math.floor(newCellSize))
  }, [gameWidth, gameHeight])

  useEffect(() => {
    const handleResize = () => {
      setCellSize(calculateCellSize())
    }

    let debounceTimer: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(handleResize, 100)
    }

    handleResize()
    window.addEventListener('resize', debouncedResize)
    return () => {
      window.removeEventListener('resize', debouncedResize)
      clearTimeout(debounceTimer)
    }
  }, [calculateCellSize])

  const analyzeQRCode = useCallback((img: HTMLImageElement) => {
    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!
    tempCanvas.width = img.width
    tempCanvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    
    // QRコードのバリデーションチェック
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (!code) {
      alert('QRコードが検出できませんでした。別の画像を試してください。')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    
    const data = imageData.data
    
    const size = Math.min(img.width, img.height)
    const qrSize = estimateQRSize(size)
    
    const newQrData: number[][] = []
    const newGameGrid: number[][] = []
    
    for (let y = 0; y < qrSize; y++) {
      newQrData[y] = []
      newGameGrid[y] = []
      for (let x = 0; x < qrSize; x++) {
        const px = Math.floor(x * size / qrSize)
        const py = Math.floor(y * size / qrSize)
        const index = (py * img.width + px) * 4
        
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3
        newQrData[y][x] = brightness < 128 ? 1 : 0
        newGameGrid[y][x] = 0
      }
    }
    
    initializeGameGrid(newQrData, newGameGrid, qrSize)
    
    setQrData(newQrData)
    setGameGrid(newGameGrid)
    setGameWidth(qrSize)
    setGameHeight(qrSize)
    setTotalBlocks(countTotalBlocks(newQrData, newGameGrid))
    setPlacedBlocks(0)
    setGameStarted(true)
    setGameCompleted(false)
    setCurrentPiece(null) // 新しいゲーム開始時にピースをリセット
  }, [])

  const estimateQRSize = (imageSize: number): number => {
    if (imageSize <= 25) return 21
    else if (imageSize <= 30) return 25
    else if (imageSize <= 35) return 29
    else return Math.min(41, Math.max(21, Math.floor(imageSize / 8) * 2 + 1))
  }

  const initializeGameGrid = (qrData: number[][], gameGrid: number[][], size: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x < 9 && y < 9) ||
            (x >= size - 8 && y < 9) ||
            (x < 9 && y >= size - 8)) {
          gameGrid[y][x] = qrData[y][x]
        }
      }
    }
  }

  const countTotalBlocks = (qrData: number[][], gameGrid: number[][]): number => {
    let count = 0
    for (let y = 0; y < qrData.length; y++) {
      for (let x = 0; x < qrData[y].length; x++) {
        if (qrData[y][x] === 1 && gameGrid[y][x] === 0) {
          count++
        }
      }
    }
    return count
  }

  const generatePiece = useCallback((): GamePiece => {
    const pieceType = TETRIS_PIECES[Math.floor(Math.random() * TETRIS_PIECES.length)]
    
    return {
      x: Math.floor((gameWidth - pieceType.shape[0].length) / 2),
      y: 0,
      shape: JSON.parse(JSON.stringify(pieceType.shape)),
      color: pieceType.color,
      width: pieceType.shape[0].length,
      height: pieceType.shape.length
    }
  }, [gameWidth])

  const rotatePiece = (piece: GamePiece): GamePiece => {
    const newShape: number[][] = []
    const rows = piece.shape.length
    const cols = piece.shape[0].length
    
    for (let i = 0; i < cols; i++) {
      newShape[i] = []
      for (let j = 0; j < rows; j++) {
        newShape[i][j] = piece.shape[rows - 1 - j][i]
      }
    }
    
    return {
      ...piece,
      shape: newShape,
      width: newShape[0].length,
      height: newShape.length
    }
  }

  const canMoveToPosition = (piece: GamePiece, newX: number, newY: number): boolean => {
    for (let y = 0; y < piece.height; y++) {
      for (let x = 0; x < piece.width; x++) {
        if (piece.shape[y][x] === 1) {
          const checkX = newX + x
          const checkY = newY + y
          
          if (checkX < 0 || checkX >= gameWidth || checkY < 0 || checkY >= gameHeight) {
            return false
          }
          
          if (gameGrid[checkY] && gameGrid[checkY][checkX] !== 0) {
            return false
          }
        }
      }
    }
    return true
  }

  const placePieceAtCurrentPosition = useCallback(() => {
    if (!currentPiece) return
    
    const newGameGrid = [...gameGrid.map(row => [...row])]
    let placedAnyBlock = false
    
    for (let y = 0; y < currentPiece.height; y++) {
      for (let x = 0; x < currentPiece.width; x++) {
        if (currentPiece.shape[y][x] === 1) {
          const placeX = currentPiece.x + x
          const placeY = currentPiece.y + y
          
          if (placeX >= 0 && placeX < gameWidth && 
              placeY >= 0 && placeY < gameHeight &&
              qrData[placeY][placeX] === 1 &&
              gameGrid[placeY][placeX] === 0) {
            
            newGameGrid[placeY][placeX] = 1
            setPlacedBlocks(prev => prev + 1)
            placedAnyBlock = true
          }
        }
      }
    }
    
    if (placedAnyBlock) {
      setGameGrid(newGameGrid)
    }
    
    setCurrentPiece(generatePiece())
  }, [currentPiece, gameGrid, qrData, gameWidth, gameHeight, generatePiece])

  const resetGame = useCallback(() => {
    // 盤面のみを初期状態に戻す
    const newGameGrid: number[][] = []
    for (let y = 0; y < gameHeight; y++) {
      newGameGrid[y] = Array(gameWidth).fill(0)
    }
    initializeGameGrid(qrData, newGameGrid, gameWidth)

    setGameGrid(newGameGrid)
    setPlacedBlocks(0)
    setCurrentPiece(generatePiece())
    setGameCompleted(false)
    setIsPaused(false)
    setDropTimer(0)

    const popup = document.querySelector('.popup')
    if (popup) popup.remove()
      // ★ フォーカス対応: ボタンからフォーカスを外し、キャンバスに当てる
    canvasRef.current?.focus()
  }, [qrData, gameWidth, gameHeight, generatePiece])

  const handleTouchControl = (action: string) => {
    if (!currentPiece || gameCompleted) return

    switch (action) {
      case 'left':
        if (canMoveToPosition(currentPiece, currentPiece.x - 1, currentPiece.y)) {
          setCurrentPiece(prev => prev ? { ...prev, x: prev.x - 1 } : null)
        }
        break
      case 'right':
        if (canMoveToPosition(currentPiece, currentPiece.x + 1, currentPiece.y)) {
          setCurrentPiece(prev => prev ? { ...prev, x: prev.x + 1 } : null)
        }
        break
      case 'down':
        if (canMoveToPosition(currentPiece, currentPiece.x, currentPiece.y + 1)) {
          setCurrentPiece(prev => prev ? { ...prev, y: prev.y + 1 } : null)
        }
        break
      case 'rotate':
        const rotated = rotatePiece(currentPiece)
        if (canMoveToPosition(rotated, rotated.x, rotated.y)) {
          setCurrentPiece(rotated)
        }
        break
      case 'place':
        placePieceAtCurrentPosition()
        break
      case 'pause':
        setIsPaused(true)
        break
      case 'restart' :
        setIsPaused(false)
        break
    }
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!currentPiece || gameCompleted) return
      
      switch (e.code) {
        case 'ArrowLeft':
          if (canMoveToPosition(currentPiece, currentPiece.x - 1, currentPiece.y)) {
            setCurrentPiece(prev => prev ? {...prev, x: prev.x - 1} : null)
          }
          break
        case 'ArrowRight':
          if (canMoveToPosition(currentPiece, currentPiece.x + 1, currentPiece.y)) {
            setCurrentPiece(prev => prev ? {...prev, x: prev.x + 1} : null)
          }
          break
        case 'ArrowDown':
          if (canMoveToPosition(currentPiece, currentPiece.x, currentPiece.y + 1)) {
            setCurrentPiece(prev => prev ? {...prev, y: prev.y + 1} : null)
          }
          break
        case 'ArrowUp':
          const rotated = rotatePiece(currentPiece)
          if (canMoveToPosition(rotated, rotated.x, rotated.y)) {
            setCurrentPiece(rotated)
          }
          break
        case 'Enter':
          placePieceAtCurrentPosition()
          break
        case 'Space':
          e.preventDefault()
          setIsPaused(!isPaused)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPiece, isPaused, gameCompleted, placePieceAtCurrentPosition])

  useEffect(() => {
    if (!gameStarted || gameCompleted || !currentPiece || isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }
    const gameLoop = () => {
      setDropTimer(prev => {
        if (prev >= dropInterval) {
          if (canMoveToPosition(currentPiece, currentPiece.x, currentPiece.y + 1)) {
            setCurrentPiece(prev => prev ? {...prev, y: prev.y + 1} : null)
            return 0
          } else {
            placePieceAtCurrentPosition()
            return 0
          }
        }
        return prev + 1
      })
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gameStarted, gameCompleted, currentPiece, isPaused, placePieceAtCurrentPosition, dropInterval])
  
  useEffect(() => {
    if (!gameStarted || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    
    canvas.width = gameWidth * cellSize
    canvas.height = gameHeight * cellSize
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      for (let y = 0; y < gameHeight; y++) {
        for (let x = 0; x < gameWidth; x++) {
          const px = x * cellSize
          const py = y * cellSize
          
          if (gameGrid[y][x] === 1) {
            ctx.fillStyle = '#000000'
            ctx.fillRect(px, py, cellSize, cellSize)
            ctx.strokeStyle = '#666666'
            ctx.strokeRect(px, py, cellSize, cellSize)
          } else if (qrData[y][x] === 1) {
            ctx.fillStyle = 'rgba(200, 200, 255, 0.4)'
            ctx.fillRect(px, py, cellSize, cellSize)
            ctx.strokeStyle = '#cccccc'
            ctx.strokeRect(px, py, cellSize, cellSize)
          } else {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(px, py, cellSize, cellSize)
            ctx.strokeStyle = '#cccccc'
            ctx.strokeRect(px, py, cellSize, cellSize)
          }
        }
      }
      
      if (currentPiece) {
        ctx.fillStyle = `rgba(${currentPiece.color[0]}, ${currentPiece.color[1]}, ${currentPiece.color[2]}, 0.8)`
        ctx.strokeStyle = '#000000'
        
        for (let y = 0; y < currentPiece.height; y++) {
          for (let x = 0; x < currentPiece.width; x++) {
            if (currentPiece.shape[y][x] === 1) {
              const px = (currentPiece.x + x) * cellSize
              const py = (currentPiece.y + y) * cellSize
              ctx.fillRect(px, py, cellSize, cellSize)
              ctx.strokeRect(px, py, cellSize, cellSize)
            }
          }
        }
      }
    }
    
    draw()
  }, [gameStarted, gameGrid, currentPiece, qrData, gameWidth, gameHeight, cellSize])

  useEffect(() => {
    if (gameStarted && !currentPiece && gameWidth > 0) {
      setCurrentPiece(generatePiece())
    }
  }, [gameStarted, currentPiece, gameWidth, generatePiece])

  useEffect(() => {
    if (gameCompleted || !gameStarted) return
    
    let completed = true
    for (let y = 0; y < gameHeight; y++) {
      for (let x = 0; x < gameWidth; x++) {
        if (qrData[y][x] === 1 && gameGrid[y][x] !== 1) {
          completed = false
          break
        }
      }
      if (!completed) break
    }
    
    if (completed) {
      setGameCompleted(true)
      const popup = document.createElement('div')
      popup.className = 'popup'
      popup.innerHTML = '🎉 COMPLETE! 🎉<br><br>QRコード完成おめでとう！'
      document.body.appendChild(popup)
      
      setTimeout(() => {
        popup.remove()
      }, 3000)
    }
  }, [gameGrid, qrData, gameCompleted, gameStarted, gameHeight, gameWidth])

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。')
        return;
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => analyzeQRCode(img)
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const progress = totalBlocks > 0 ? Math.round((placedBlocks / totalBlocks) * 100) : 0

  return (
    <div className="container">
      <h1 className="title">QRコードテトリス</h1>
      <p className="subtitle">QRコードをアップロードして、<br />ブロックを積み重ねて元の画像を完成させよう！</p>
      
      {!gameStarted && (
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ fontSize: '1.3rem', marginBottom: '20px' }}><QrCode /> QRコードの画像をここにドラッグ＆ドロップ</p>
          <p style={{ marginBottom: '20px' }}>または</p>
          <button className="upload-btn">
            <AttachFile /> ファイルを選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {gameStarted && (
        <div className="game-container">
          <div className="game-area">
            {/* ★ フォーカス対応: tabIndexを追加してフォーカス可能にする */}
            <canvas ref={canvasRef} tabIndex={-1} />
          </div>
          <div className="controls">
          {!isMobile && <div>
              <h3>操作方法</h3>
              <>
                <div className="control-item">
                  <span>左右移動</span>
                  <span>← →</span>
                </div>
                <div className="control-item">
                  <span>回転</span>
                  <span>↑</span>
                </div>
                <div className="control-item">
                  <span>高速落下</span>
                  <span>↓</span>
                </div>
                <div className="control-item">
                  <span>配置決定</span>
                  <span>Enter</span>
                </div>
                <div className="control-item">
                  <span>一時停止</span>
                  <span>Space</span>
                </div>
              </>
              <button 
                className="upload-btn place-btn"
                onClick={placePieceAtCurrentPosition}
              >
                配置決定
              </button>
              <button 
                className="reset-btn"
                onClick={resetGame}
              >
                リセット
              </button>
            </div>}
            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
              <h4 style={{ marginTop: 0, color: 'var(--secondary)' }}><Summarize /> 統計</h4>
              <div className="control-item">
                <span>配置済み</span>
                <span>{placedBlocks}</span>
              </div>
              <div className="control-item">
                <span>残り</span>
                <span>{totalBlocks - placedBlocks}</span>
              </div>
              <div className="control-item">
                <span>進捗</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
          {isMobile && (
            <div className="mobile-controls">
              <div className="controller">
                <div className="d-pad">
                  <Button
                    className="control-btn up"
                    variant="contained"
                    color="primary"
                    onTouchStart={() => handleTouchControl('rotate')}
                  >
                    <RotateRightIcon />
                  </Button>
                  <div className="horizontal">
                    <Button
                      className="control-btn left"
                      variant="contained"
                      color="primary"
                      onTouchStart={() => handleTouchControl('left')}
                    >
                      <ArrowLeftIcon />
                    </Button>
                    <Button
                      className="control-btn down"
                      variant="contained"
                      color="primary"
                      onTouchStart={() => handleTouchControl('down')}
                    >
                      <ArrowDownwardIcon />
                    </Button>
                    <Button
                      className="control-btn right"
                      variant="contained"
                      color="primary"
                      onTouchStart={() => handleTouchControl('right')}
                    >
                      <ArrowRightIcon />
                    </Button>
                  </div>
                </div>
                <div className="action-buttons">
                  <Button
                    className="control-btn place"
                    variant="contained"
                    color="primary"
                    onTouchStart={() => handleTouchControl('place')}
                  >
                    <Box component="span" sx={{ mr: 0.5 }}>
                      <PlaceIcon />
                    </Box> 配置
                  </Button>
                  <Button 
                    className="control-btn reset"
                    variant="contained"
                    color="primary"
                    onTouchStart={resetGame}
                  >
                    <Box component="span" sx={{ mr: 0.5 }}>
                      <Clear />
                    </Box> リセット
                  </Button>
                  <Button
                    className="control-btn pause"
                    variant="contained"
                    color="primary"
                    onTouchStart={() => handleTouchControl(isPaused ? 'restart' : 'pause')}
                  >
                    {isPaused ? (
                      <>
                        <Box component="span" sx={{ mr: 0.5 }}>
                          <PlayArrowIcon />
                        </Box>
                        再開
                      </>
                    ) : (
                      <>
                        <Box component="span" sx={{ mr: 0.5 }}>
                          <PauseIcon />
                        </Box>
                        一時停止
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
