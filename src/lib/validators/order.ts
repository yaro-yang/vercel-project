import { z } from 'zod'

export const orderItemSchema = z.object({
  name: z.string().min(1, '商品名称不能为空'),
  quantity: z.number().min(1, '数量至少为1'),
  price: z.number().min(0, '价格不能为负数'),
})

export const createOrderSchema = z.object({
  orderNo: z.string().min(1, '订单号不能为空'),
  customerName: z.string().min(1, '客户名称不能为空'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  address: z.string().optional(),
  items: z.array(orderItemSchema).min(1, '至少需要一个商品'),
  totalAmount: z.number().min(0),
  discount: z.number().min(0).optional(),
  finalAmount: z.number().min(0),
  source: z.string().optional(),
  templateId: z.string().optional(),
})

export type CreateOrderSchema = z.infer<typeof createOrderSchema>
