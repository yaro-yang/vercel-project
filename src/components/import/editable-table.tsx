'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { WaybillData, WAYBILL_FIELDS, ValidationError, TEMP_LAYER_OPTIONS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Trash2,
  Plus,
  FileSpreadsheet,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'

interface EditableTableProps {
  waybills: WaybillData[]
  onDataChange: (waybills: WaybillData[]) => void
  isSubmitting?: boolean
}

export function EditableTable({ waybills, onDataChange, isSubmitting }: EditableTableProps) {
  const [editingCell, setEditingCell] = useState<{ tempId: string; field: string } | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // 排序
  const sortedWaybills = useMemo(() => {
    if (!sortConfig) return waybills
    
    return [...waybills].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof WaybillData]
      const bVal = b[sortConfig.key as keyof WaybillData]
      
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal)
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return 0
    })
  }, [waybills, sortConfig])

  // 统计信息
  const stats = useMemo(() => {
    const valid = waybills.filter(w => w.isValid).length
    const invalid = waybills.length - valid
    const errors = waybills.reduce((sum, w) => sum + w.errors.length, 0)
    const duplicates = waybills.filter(w => w.isDuplicate || w.isExistingDuplicate).length
    
    return { valid, invalid, errors, duplicates, total: waybills.length }
  }, [waybills])

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  const handleCellEdit = useCallback((tempId: string, field: string, value: string | number | undefined) => {
    const updated = waybills.map(wb => {
      if (wb.tempId === tempId) {
        const updatedWb = { ...wb, [field]: value }
        
        // 清除该字段的错误
        updatedWb.errors = updatedWb.errors.filter(e => e.field !== field)
        
        // 重新验证
        if (field === 'receiverPhone' && value) {
          const phoneRegex = /^1[3-9]\d{9}$/
          const phoneAltRegex = /^\d{3,4}-?\d{7,8}$/
          if (!phoneRegex.test(value as string) && !phoneAltRegex.test(value as string)) {
            updatedWb.errors.push({
              field: 'receiverPhone',
              message: '电话格式错误',
              code: 'PHONE_FORMAT',
            })
          }
        }
        
        if (field === 'goodsWeight' && value !== undefined && (value as number) < 0) {
          updatedWb.errors.push({
            field: 'goodsWeight',
            message: '重量必须为非负数',
            code: 'WEIGHT_INVALID',
          })
        }
        
        if (field === 'goodsCount' && value !== undefined) {
          const count = parseInt(value as string)
          if (!Number.isInteger(count) || count < 1) {
            updatedWb.errors.push({
              field: 'goodsCount',
              message: '件数必须为正整数',
              code: 'COUNT_INVALID',
            })
          }
        }
        
        if (field === 'tempLayer' && value) {
          const validLayers = TEMP_LAYER_OPTIONS.map(t => t.value)
          if (!validLayers.includes(value as string)) {
            updatedWb.errors.push({
              field: 'tempLayer',
              message: `温层值必须在 [${validLayers.join(', ')}] 范围内`,
              code: 'TEMP_LAYER_INVALID',
            })
          }
        }
        
        // 更新必填字段错误
        if (field === 'receiverName' && !value) {
          updatedWb.errors.push({
            field: 'receiverName',
            message: '收件人不能为空',
            code: 'REQUIRED',
          })
        }
        
        // 更新有效性
        updatedWb.isValid = updatedWb.errors.length === 0
        
        return updatedWb
      }
      return wb
    })
    
    onDataChange(updated)
    setEditingCell(null)
  }, [waybills, onDataChange])

  const handleDeleteRow = useCallback((tempId: string) => {
    const updated = waybills.filter(wb => wb.tempId !== tempId)
    onDataChange(updated)
  }, [waybills, onDataChange])

  const handleAddRow = useCallback(() => {
    const newRow: WaybillData = {
      id: uuidv4(),
      tempId: uuidv4(),
      rowIndex: waybills.length + 1,
      receiverName: '',
      isValid: false,
      errors: [{ field: 'receiverName', message: '收件人不能为空', code: 'REQUIRED' }],
      isDuplicate: false,
      isExistingDuplicate: false,
    }
    onDataChange([...waybills, newRow])
  }, [waybills, onDataChange])

  const handleDuplicateRow = useCallback((wb: WaybillData) => {
    const newRow: WaybillData = {
      ...wb,
      id: uuidv4(),
      tempId: uuidv4(),
      rowIndex: waybills.length + 1,
      externalNo: undefined,
      isValid: wb.isValid,
      errors: [],
      isDuplicate: false,
      isExistingDuplicate: false,
    }
    onDataChange([...waybills, newRow])
  }, [waybills, onDataChange])

  const handleExportExcel = useCallback(() => {
    const exportData = sortedWaybills.map(wb => {
      const row: Record<string, unknown> = { '#': wb.rowIndex }
      WAYBILL_FIELDS.forEach(field => {
        row[field.label] = wb[field.key as keyof WaybillData] ?? ''
      })
      row['状态'] = wb.isValid ? '有效' : '无效'
      row['错误'] = wb.errors.map(e => e.message).join('; ')
      return row
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '运单数据')
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 5 }, // #
      ...WAYBILL_FIELDS.map(() => ({ wch: 12 })),
      { wch: 8 },
      { wch: 30 },
    ]

    XLSX.writeFile(wb, `运单数据_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [sortedWaybills])

  const getFieldErrors = (wb: WaybillData, field: string): ValidationError[] => {
    return wb.errors.filter(e => e.field === field)
  }

  const getRowClassName = (wb: WaybillData) => {
    const classes = []
    if (!wb.isValid) classes.push('bg-red-50')
    else if (wb.isDuplicate || wb.isExistingDuplicate) classes.push('bg-yellow-50')
    return classes.join(' ')
  }

  const getCellClassName = (wb: WaybillData, field: string) => {
    const classes = ['px-2', 'py-1', 'border-r', 'border-b', 'border-border', 'min-h-[40px]']
    const errors = getFieldErrors(wb, field)
    
    if (errors.length > 0) {
      classes.push('bg-red-100', 'border-red-300')
    }
    
    if (wb.isDuplicate && field === 'externalNo') {
      classes.push('bg-yellow-100')
    }
    
    return classes.join(' ')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              数据预览与编辑
            </CardTitle>
            <CardDescription>
              点击单元格可直接编辑，错误行需要修正后才能提交
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddRow} disabled={isSubmitting}>
              <Plus className="h-4 w-4 mr-1" />
              新增行
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isSubmitting}>
              <Download className="h-4 w-4 mr-1" />
              导出 Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 统计信息 */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">总条数</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
            <div className="text-xs text-green-600">有效</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
            <div className="text-xs text-red-600">有错误</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.duplicates}</div>
            <div className="text-xs text-yellow-600">重复</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.errors}</div>
            <div className="text-xs text-blue-600">错误数</div>
          </div>
        </div>

        {/* 错误汇总 */}
        {stats.errors > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">错误汇总</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {waybills.flatMap(wb => wb.errors.map(err => (
                <div key={`${wb.tempId}-${err.field}`} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    第 {wb.rowIndex} 行
                  </Badge>
                  <span className="font-medium">{err.field}:</span>
                  <span className="text-muted-foreground">{err.message}</span>
                </div>
              ))).slice(0, 20)}
              {stats.errors > 20 && (
                <p className="text-xs text-muted-foreground">
                  还有 {stats.errors - 20} 个错误...
                </p>
              )}
            </div>
          </div>
        )}

        {/* 表格 */}
        <div ref={tableRef} className="border rounded-lg overflow-auto max-h-[600px]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted shadow-sm">
              <tr>
                <th className="px-2 py-3 text-left font-medium border-b border-r border-border w-12">
                  #
                </th>
                <th className="px-2 py-3 text-left font-medium border-b border-r border-border w-12">
                  操作
                </th>
                <th className="px-2 py-3 text-left font-medium border-b border-r border-border">
                  状态
                </th>
                {WAYBILL_FIELDS.map((field) => (
                  <th
                    key={field.key}
                    className="px-2 py-3 text-left font-medium border-b border-r border-border min-w-[100px]"
                    style={{ width: field.width }}
                  >
                    <div className="flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedWaybills.map((wb) => (
                <tr key={wb.tempId} className={getRowClassName(wb)}>
                  {/* 行号 */}
                  <td className="px-2 py-1 border-b border-r border-border text-center text-muted-foreground">
                    {wb.rowIndex}
                  </td>
                  
                  {/* 操作按钮 */}
                  <td className="px-1 py-1 border-b border-r border-border">
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDuplicateRow(wb)}
                              disabled={isSubmitting}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>复制行</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteRow(wb.tempId)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>删除行</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                  
                  {/* 状态 */}
                  <td className="px-2 py-1 border-b border-r border-border">
                    <TooltipProvider>
                      {wb.isValid ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </TooltipTrigger>
                          <TooltipContent>数据有效</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {wb.errors.length} 个错误
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {wb.isDuplicate && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="warning" className="ml-1">重复</Badge>
                          </TooltipTrigger>
                          <TooltipContent>外部编码重复</TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </td>
                  
                  {/* 数据列 */}
                  {WAYBILL_FIELDS.map((field) => {
                    const value = wb[field.key as keyof WaybillData] as string | number | undefined
                    const errors = getFieldErrors(wb, field.key)
                    const isEditing = editingCell?.tempId === wb.tempId && editingCell?.field === field.key
                    
                    return (
                      <td
                        key={field.key}
                        className={getCellClassName(wb, field.key)}
                        onClick={() => !isSubmitting && setEditingCell({ tempId: wb.tempId, field: field.key })}
                      >
                        {isEditing ? (
                          field.key === 'tempLayer' ? (
                            <Select
                              value={String(value || '')}
                              onValueChange={(v) => handleCellEdit(wb.tempId, field.key, v)}
                              open
                              onOpenChange={(open) => !open && setEditingCell(null)}
                            >
                              <SelectTrigger className="h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">请选择</SelectItem>
                                {TEMP_LAYER_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-background focus:px-1"
                              value={value ?? ''}
                              onChange={(e) => {
                                const newValue = field.type === 'number' 
                                  ? parseFloat(e.target.value) || undefined
                                  : e.target.value
                                handleCellEdit(wb.tempId, field.key, newValue as string | number | undefined)
                              }}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  setEditingCell(null)
                                }
                              }}
                              autoFocus
                              type={field.type === 'number' ? 'number' : 'text'}
                            />
                          )
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="truncate">
                              {value !== undefined && value !== null && value !== '' 
                                ? String(value) 
                                : <span className="text-muted-foreground">-</span>}
                            </span>
                            {errors.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <div className="space-y-1">
                                      {errors.map((err, i) => (
                                        <div key={i} className="text-xs">
                                          {err.message}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {sortedWaybills.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            暂无数据
          </div>
        )}
      </CardContent>
    </Card>
  )
}
