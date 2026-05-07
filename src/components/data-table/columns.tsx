import { ColumnDef } from '@tanstack/react-table'
import { Order } from '@prisma/client'
import { formatCurrency, formatDate } from '@/lib/utils'

export const orderColumns: ColumnDef<Order>[] = [
  {
    accessorKey: 'orderNo',
    header: '订单号',
    size: 180,
  },
  {
    accessorKey: 'customerName',
    header: '客户名称',
    size: 120,
  },
  {
    accessorKey: 'customerPhone',
    header: '联系电话',
    size: 130,
  },
  {
    accessorKey: 'totalAmount',
    header: '总金额',
    size: 100,
    cell: ({ row }) => formatCurrency(row.original.totalAmount),
  },
  {
    accessorKey: 'discount',
    header: '折扣',
    size: 80,
    cell: ({ row }) => row.original.discount ? formatCurrency(row.original.discount) : '-',
  },
  {
    accessorKey: 'finalAmount',
    header: '实付金额',
    size: 100,
    cell: ({ row }) => formatCurrency(row.original.finalAmount),
  },
  {
    accessorKey: 'status',
    header: '状态',
    size: 100,
    cell: ({ row }) => {
      const status = row.original.status
      const variants: Record<string, string> = {
        PENDING: 'bg-yellow-500',
        CONFIRMED: 'bg-blue-500',
        PROCESSING: 'bg-purple-500',
        SHIPPED: 'bg-indigo-500',
        COMPLETED: 'bg-green-500',
        CANCELLED: 'bg-gray-500',
      }
      const labels: Record<string, string> = {
        PENDING: '待处理',
        CONFIRMED: '已确认',
        PROCESSING: '处理中',
        SHIPPED: '已发货',
        COMPLETED: '已完成',
        CANCELLED: '已取消',
      }
      return (
        <span className={`px-2 py-1 rounded-full text-xs text-white ${variants[status]}`}>
          {labels[status]}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: '创建时间',
    size: 160,
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
]
