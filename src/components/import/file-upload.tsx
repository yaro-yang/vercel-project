'use client'

import { useCallback, useState, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseExcel } from '@/lib/parsers/excel'
import { parseCSV } from '@/lib/parsers/csv'
import { ParseResult } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface FileUploadProps {
  onFileParsed: (result: ParseResult) => void
  onError?: (error: string) => void
  maxSize?: number
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error'

export function FileUpload({ onFileParsed, onError, maxSize = 50 }: FileUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    // 文件大小检查
    if (file.size > maxSize * 1024 * 1024) {
      const err = `文件大小不能超过 ${maxSize}MB，当前文件 ${(file.size / 1024 / 1024).toFixed(2)}MB`
      setError(err)
      setState('error')
      onError?.(err)
      return
    }

    // 文件名检查
    if (!file.name) {
      const err = '文件名不能为空'
      setError(err)
      setState('error')
      onError?.(err)
      return
    }

    setState('uploading')
    setProgress(10)
    setFileName(file.name)
    setError(null)

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 80))
      }, 100)

      const extension = file.name.split('.').pop()?.toLowerCase()
      let result: ParseResult

      switch (extension) {
        case 'xlsx':
        case 'xls':
          result = await parseExcel(file)
          break
        case 'csv':
          result = await parseCSV(file)
          break
        default:
          throw new Error(`不支持的文件格式: .${extension}。请上传 .xlsx、.xls 或 .csv 文件`)
      }

      clearInterval(progressInterval)
      setProgress(100)

      if (result.rows.length === 0) {
        throw new Error('文件内容为空，请检查文件是否有数据')
      }

      if (result.headers.length === 0) {
        throw new Error('无法读取表头，请确认文件格式正确')
      }

      // 检查是否有空的列名
      const emptyHeaders = result.headers.filter(h => !h || h.trim() === '')
      if (emptyHeaders.length > 0) {
        console.warn('存在空列名:', emptyHeaders)
      }

      setState('success')
      
      // 延迟回调让用户看到成功状态
      setTimeout(() => {
        onFileParsed({
          ...result,
          fileName: file.name,
          fileSize: file.size,
        })
      }, 500)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件解析失败'
      setError(errorMessage)
      setState('error')
      onError?.(errorMessage)
    }
  }, [maxSize, onFileParsed, onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')

    const files = e.dataTransfer.files
    if (files.length === 0) {
      setError('未检测到文件')
      setState('error')
      return
    }

    if (files.length > 1) {
      setError('只支持单个文件上传')
      setState('error')
      return
    }

    parseFile(files[0])
  }, [parseFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('dragging')
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseFile(file)
    }
  }, [parseFile])

  const handleReset = useCallback(() => {
    setState('idle')
    setProgress(0)
    setFileName(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          上传文件
        </CardTitle>
        <CardDescription>
          支持 Excel (.xlsx, .xls) 和 CSV (.csv) 格式，文件大小限制 {maxSize}MB
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg transition-all cursor-pointer',
            state === 'idle' && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5',
            state === 'dragging' && 'border-primary bg-primary/10 scale-[1.02]',
            state === 'uploading' && 'border-blue-500 bg-blue-500/5',
            state === 'success' && 'border-green-500 bg-green-500/5',
            state === 'error' && 'border-destructive bg-destructive/5'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => state !== 'uploading' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={state === 'uploading'}
          />
          
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            {state === 'idle' && (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">拖拽文件到此处</p>
                  <p className="text-sm text-muted-foreground mt-1">或点击选择文件</p>
                </div>
              </>
            )}

            {state === 'dragging' && (
              <>
                <FileSpreadsheet className="h-12 w-12 text-primary animate-pulse" />
                <p className="font-medium text-primary">释放以上传文件</p>
              </>
            )}

            {state === 'uploading' && (
              <>
                <FileSpreadsheet className="h-12 w-12 text-blue-500 animate-pulse" />
                <div className="w-full max-w-xs space-y-2">
                  <p className="text-sm text-center font-medium">{fileName}</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    正在解析文件... {progress}%
                  </p>
                </div>
              </>
            )}

            {state === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <div className="text-center">
                  <p className="font-medium text-green-600">{fileName}</p>
                  <p className="text-sm text-muted-foreground">上传成功！正在跳转...</p>
                </div>
              </>
            )}

            {state === 'error' && (
              <>
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                  <p className="font-medium text-destructive">上传失败</p>
                  <p className="text-sm text-destructive mt-1">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => {
                  e.stopPropagation()
                  handleReset()
                }}>
                  重新上传
                </Button>
              </>
            )}
          </div>
        </div>

        {state === 'idle' && (
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>支持多个工作表</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>自动检测表头</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>支持 1000+ 条数据</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
