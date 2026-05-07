'use client'

import { useState } from 'react'
import { DataTable } from '@/components/data-table/data-table'
import { CreateOrderInput, ImportError } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, FileSpreadsheet, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PreviewTableProps {
  orders: CreateOrderInput[]
  errors: ImportError[]
  totalRows: number
  onConfirm: () => void
  onCancel: () => void
  onRemoveError: (index: number) => void
  isSubmitting?: boolean
}

export function PreviewTable({
  orders,
  errors,
  totalRows,
  onConfirm,
  onCancel,
  onRemoveError,
  isSubmitting,
}: PreviewTableProps) {
  const [showErrors, setShowErrors] = useState(true)

  const columns = [
    {
      accessorKey: 'orderNo' as const,
      header: '订单号',
      cell: ({ row }: { row: { original: CreateOrderInput } }) => row.original.orderNo || '自动生成',
    },
    {
      accessorKey: 'customerName' as const,
      header: '客户名称',
    },
    {
      accessorKey: 'customerPhone' as const,
      header: '联系电话',
    },
    {
      accessorKey: 'items' as const,
      header: '商品数量',
      cell: ({ row }: { row: { original: CreateOrderInput } }) => row.original.items?.length || 0,
    },
    {
      accessorKey: 'totalAmount' as const,
      header: '总金额',
      cell: ({ row }: { row: { original: CreateOrderInput } }) => formatCurrency(row.original.totalAmount),
    },
    {
      accessorKey: 'finalAmount' as const,
      header: '实付金额',
      cell: ({ row }: { row: { original: CreateOrderInput } }) => formatCurrency(row.original.finalAmount),
    },
  ]

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalRows}</div>
            <p className="text-sm text-muted-foreground">总行数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{orders.length}</div>
            <p className="text-sm text-muted-foreground">有效订单</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{errors.length}</div>
            <p className="text-sm text-muted-foreground">错误数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {orders.reduce((sum, o) => sum + Number(o.finalAmount), 0).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">订单总额</p>
          </CardContent>
        </Card>
      </div>

      {/* 错误列表 */}
      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                导入错误 ({errors.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowErrors(!showErrors)}>
                {showErrors ? '收起' : '展开'}
              </Button>
            </div>
            <CardDescription>
              以下行存在错误，将被跳过。修正后重新导入。
            </CardDescription>
          </CardHeader>
          {showErrors && (
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {errors.slice(0, 50).map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">第 {error.row} 行</Badge>
                        <span className="text-sm font-medium">{error.field}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{error.message}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveError(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {errors.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    还有 {errors.length - 50} 个错误未显示
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 预览表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            数据预览
          </CardTitle>
          <CardDescription>
            共 {orders.length} 个订单，确认无误后点击「确认导入」
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={orders} />
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button onClick={onConfirm} disabled={orders.length === 0 || isSubmitting}>
          {isSubmitting ? (
            <>导入中...</>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              确认导入 ({orders.length})
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
