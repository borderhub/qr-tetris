'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

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
  
  const dropInterval = 60

  // cellSizeを動的に計算する関数
  const calculateCellSize = useCallback(() => {
    if (!gameWidth || !gameHeight) return 20 // 初期値

    const windowWidth = window.innerWidth
    const maxCanvasWidth = windowWidth * 0.8 // 画面幅の90%を最大とする
    const maxCanvasHeight = window.innerHeight * 0.6 // 画面高さの60%を最大とする

    // gameWidth と gameHeight に基づいて cellSize を計算
    const cellSizeByWidth = maxCanvasWidth / gameWidth
    const cellSizeByHeight = maxCanvasHeight / gameHeight
    const newCellSize = Math.min(cellSizeByWidth, cellSizeByHeight, 30) // 最大30pxに制限
    return Math.max(8, Math.floor(newCellSize)) // 最小10pxを保証
  }, [gameWidth, gameHeight])

  // ウィンドウリサイズ時にcellSizeを更新
  useEffect(() => {
    const handleResize = () => {
      setCellSize(calculateCellSize())
    }

    // デバウンス処理
    let debounceTimer: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(handleResize, 100) // 100ms待機
    }

    handleResize() // 初回実行
    window.addEventListener('resize', debouncedResize)
    return () => {
      window.removeEventListener('resize', debouncedResize)
      clearTimeout(debounceTimer)
    }
  }, [calculateCellSize])

  // QRコード解析
  const analyzeQRCode = useCallback((img: HTMLImageElement) => {
    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d')!
    tempCanvas.width = img.width
    tempCanvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
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
    
    // 外枠を初期配置
    initializeGameGrid(newQrData, newGameGrid, qrSize)
    
    setQrData(newQrData)
    setGameGrid(newGameGrid)
    setGameWidth(qrSize)
    setGameHeight(qrSize)
    setTotalBlocks(countTotalBlocks(newQrData, newGameGrid))
    setGameStarted(true)
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

  // ピース生成
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

  // ピース回転
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

  // 移動可能チェック
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

  // ピース配置
  const placePieceAtCurrentPosition = useCallback(() => {
    if (!currentPiece) return
    
    let placedAnyBlock = false
    const newGameGrid = [...gameGrid]
    
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

  // リセット機能
  const resetGame = useCallback(() => {
    setGameStarted(false)
    setGameCompleted(false)
    setCurrentPiece(null)
    setQrData([])
    setGameGrid([])
    setPlacedBlocks(0)
    setTotalBlocks(0)
    setDropTimer(0)
    setGameWidth(0)
    setGameHeight(0)
    setIsPaused(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    const popup = document.querySelector('.popup')
    if (popup) popup.remove()
  }, [])

  // タッチ操作ハンドラ
  const handleTouchControl = (action: string) => {
    if (!currentPiece || isPaused || gameCompleted) return

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
        setIsPaused(prev => !prev)
        break
    }
  }

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!currentPiece || isPaused || gameCompleted) return
      
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
          setIsPaused(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentPiece, isPaused, gameCompleted, placePieceAtCurrentPosition])

  // ゲームループ
  useEffect(() => {
    if (!gameStarted || gameCompleted || !currentPiece) return

    const gameLoop = () => {
      if (!isPaused) {
        setDropTimer(prev => {
          if (prev >= dropInterval) {
            if (canMoveToPosition(currentPiece, currentPiece.x, currentPiece.y + 1)) {
              setCurrentPiece(prev => prev ? {...prev, y: prev.y + 1} : null)
            } else {
              placePieceAtCurrentPosition()
            }
            return 0
          }
          return prev + 1
        })
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gameStarted, gameCompleted, currentPiece, isPaused, placePieceAtCurrentPosition])

  // キャンバス描画
  useEffect(() => {
    if (!gameStarted || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    
    // キャンバスサイズ設定
    canvas.width = gameWidth * cellSize
    canvas.height = gameHeight * cellSize
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // グリッド描画
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
      
      // 現在のピース描画
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
  }, [gameStarted, gameGrid, currentPiece, qrData, gameWidth, gameHeight])

  // 初期ピース生成
  useEffect(() => {
    if (gameStarted && !currentPiece && gameWidth > 0) {
      setCurrentPiece(generatePiece())
    }
  }, [gameStarted, currentPiece, gameWidth, generatePiece])

  // ゲーム完了チェック
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

  // ファイルアップロード処理
  const handleFileUpload = (file: File) => {
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
      <h1 className="title">🎮 QRコードテトリスゲーム</h1>
      <p className="subtitle">QRコードをアップロードして、ブロックを積み重ねて元の画像を完成させよう！</p>
      
      {!gameStarted && (
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ fontSize: '1.3rem', marginBottom: '20px' }}>📱 QRコードの画像をここにドラッグ＆ドロップ</p>
          <p style={{ marginBottom: '20px' }}>または</p>
          <button className="upload-btn">
            📁 ファイルを選択
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
            <canvas ref={canvasRef} />
          </div>
          <div className="controls">
            <h3>🎮 操作方法</h3>
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
            <button 
              className="upload-btn place-btn"
              onClick={placePieceAtCurrentPosition}
            >
              📍 配置決定
            </button>
            <button 
              className="reset-btn"
              onClick={resetGame}
            >
              🔄 リセット
            </button>
            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
              <h4 style={{ marginTop: 0, color: 'var(--secondary)' }}>📊 統計</h4>
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
        </div>
      )}
    </div>
  )
}
