"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import type { OrderStatus, PaginatedResult, OrderFilters, Order } from "@/types";

/**
 * 创建单个订单
 */
export async function createOrder(data: {
  externalCode?: string;
  senderName: string;
  senderPhone?: string;
  senderAddress?: string;
  receiverName: string;
  receiverPhone?: string;
  receiverAddress?: string;
  quantity?: number;
  weight?: number;
  temperature?: string;
  remark?: string;
  templateId?: string;
  batchId?: string;
  rawData?: Record<string, unknown>;
}) {
  const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  try {
    const order = await prisma.order.create({
      data: {
        orderNo,
        externalCode: data.externalCode,
        senderName: data.senderName,
        senderPhone: data.senderPhone,
        senderAddress: data.senderAddress,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        receiverAddress: data.receiverAddress,
        quantity: data.quantity,
        weight: data.weight,
        temperature: data.temperature,
        remark: data.remark,
        templateId: data.templateId,
        batchId: data.batchId,
        rawData: data.rawData as object,
      },
    });

    return { success: true, data: order };
  } catch (error) {
    console.error("Create order error:", error);
    return { success: false, error: "创建订单失败" };
  }
}

/**
 * 批量导入订单
 */
export async function batchImportOrders(
  orders: Array<{
    externalCode?: string;
    senderName: string;
    senderPhone?: string;
    senderAddress?: string;
    receiverName: string;
    receiverPhone?: string;
    receiverAddress?: string;
    quantity?: number;
    weight?: number;
    temperature?: string;
    remark?: string;
  }>,
  options: {
    filename?: string;
    templateId?: string;
    templateName?: string;
  } = {}
): Promise<{
  batchId: string;
  successCount: number;
  failedCount: number;
  errors: Array<{ row?: number; message: string }>;
}> {
  const batchId = uuidv4();
  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ row?: number; message: string }> = [];

  // 创建批次记录
  const batch = await prisma.importBatch.create({
    data: {
      id: batchId,
      filename: options.filename || "unknown.xlsx",
      templateId: options.templateId,
      templateName: options.templateName,
      totalCount: orders.length,
      status: "PROCESSING",
    },
  });

  try {
    // 批量处理，每批 50 条
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batchOrders = orders.slice(i, i + BATCH_SIZE);
      
      for (let j = 0; j < batchOrders.length; j++) {
        const orderData = batchOrders[j];
        const rowIndex = i + j + 1;

        try {
          const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          
          await prisma.order.create({
            data: {
              orderNo,
              externalCode: orderData.externalCode,
              senderName: orderData.senderName,
              senderPhone: orderData.senderPhone,
              senderAddress: orderData.senderAddress,
              receiverName: orderData.receiverName,
              receiverPhone: orderData.receiverPhone,
              receiverAddress: orderData.receiverAddress,
              quantity: orderData.quantity,
              weight: orderData.weight,
              temperature: orderData.temperature,
              remark: orderData.remark,
              templateId: options.templateId,
              batchId: batchId,
              status: "PENDING",
            },
          });

          successCount++;
        } catch (err) {
          failedCount++;
          const errorMessage = err instanceof Error ? err.message : "未知错误";
          errors.push({ row: rowIndex, message: errorMessage });
        }
      }
    }

    // 更新批次状态
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        successCount,
        failedCount,
        status: failedCount === orders.length ? "FAILED" : "COMPLETED",
        completedAt: new Date(),
        errors: errors as object[],
      },
    });

    revalidatePath("/orders");

    return { batchId, successCount, failedCount, errors };
  } catch (error) {
    // 更新批次为失败状态
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errors: [{ message: error instanceof Error ? error.message : "批次处理失败" }] as object[],
      },
    });

    return { 
      batchId, 
      successCount: 0, 
      failedCount: orders.length, 
      errors: [{ message: "批次处理失败" }] 
    };
  }
}

/**
 * 获取订单列表（分页）
 */
export async function getOrders(
  filters: OrderFilters = {},
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<Order>> {
  const { page, pageSize } = pagination;
  const skip = (page - 1) * pageSize;

  // 构建查询条件
  const where: Record<string, unknown> = {};

  if (filters.search) {
    where.OR = [
      { orderNo: { contains: filters.search, mode: "insensitive" } },
      { externalCode: { contains: filters.search, mode: "insensitive" } },
      { receiverName: { contains: filters.search, mode: "insensitive" } },
      { receiverPhone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.templateId) {
    where.templateId = filters.templateId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = endDate;
    }
  }

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          template: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // 转换数据格式
    const items: Order[] = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      externalCode: o.externalCode || undefined,
      senderName: o.senderName,
      senderPhone: o.senderPhone || undefined,
      senderAddress: o.senderAddress || undefined,
      receiverName: o.receiverName,
      receiverPhone: o.receiverPhone || undefined,
      receiverAddress: o.receiverAddress || undefined,
      quantity: o.quantity || undefined,
      weight: o.weight ? Number(o.weight) : undefined,
      temperature: o.temperature || undefined,
      remark: o.remark || undefined,
      totalAmount: o.totalAmount ? Number(o.totalAmount) : undefined,
      discount: o.discount ? Number(o.discount) : undefined,
      finalAmount: o.finalAmount ? Number(o.finalAmount) : undefined,
      status: o.status as OrderStatus,
      source: o.source || undefined,
      templateId: o.templateId || undefined,
      batchId: o.batchId || undefined,
      rawData: o.rawData as Record<string, unknown> | undefined,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Get orders error:", error);
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

/**
 * 获取单个订单
 */
export async function getOrder(id: string): Promise<Order | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        template: true,
        batch: true,
      },
    });

    if (!order) return null;

    return {
      id: order.id,
      orderNo: order.orderNo,
      externalCode: order.externalCode || undefined,
      senderName: order.senderName,
      senderPhone: order.senderPhone || undefined,
      senderAddress: order.senderAddress || undefined,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone || undefined,
      receiverAddress: order.receiverAddress || undefined,
      quantity: order.quantity || undefined,
      weight: order.weight ? Number(order.weight) : undefined,
      temperature: order.temperature || undefined,
      remark: order.remark || undefined,
      totalAmount: order.totalAmount ? Number(order.totalAmount) : undefined,
      discount: order.discount ? Number(order.discount) : undefined,
      finalAmount: order.finalAmount ? Number(order.finalAmount) : undefined,
      status: order.status as OrderStatus,
      source: order.source || undefined,
      templateId: order.templateId || undefined,
      batchId: order.batchId || undefined,
      rawData: order.rawData as Record<string, unknown> | undefined,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error("Get order error:", error);
    return null;
  }
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.order.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/orders");
    return { success: true };
  } catch (error) {
    return { success: false, error: "更新状态失败" };
  }
}

/**
 * 批量更新订单状态
 */
export async function batchUpdateOrderStatus(
  ids: string[],
  status: OrderStatus
): Promise<{ success: number; failed: number }> {
  try {
    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    revalidatePath("/orders");
    return { success: result.count, failed: ids.length - result.count };
  } catch (error) {
    return { success: 0, failed: ids.length };
  }
}

/**
 * 删除订单
 */
export async function deleteOrder(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.order.delete({ where: { id } });
    revalidatePath("/orders");
    return { success: true };
  } catch (error) {
    return { success: false, error: "删除失败" };
  }
}

/**
 * 获取导入批次列表
 */
export async function getImportBatches(
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 }
) {
  const { page, pageSize } = pagination;
  const skip = (page - 1) * pageSize;

  try {
    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.importBatch.count(),
    ]);

    return {
      items: batches,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Get batches error:", error);
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

/**
 * 获取统计数据
 */
export async function getOrderStats() {
  try {
    const [total, pending, processing, completed, todayCount] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return { total, pending, processing, completed, todayCount };
  } catch (error) {
    return { total: 0, pending: 0, processing: 0, completed: 0, todayCount: 0 };
  }
}

/**
 * 检查外部编码是否存在
 */
export async function checkExternalNoExists(externalNos: string[]): Promise<Set<string>> {
  if (externalNos.length === 0) return new Set();
  
  try {
    const orders = await prisma.order.findMany({
      where: {
        externalCode: { in: externalNos },
      },
      select: { externalCode: true },
    });
    
    return new Set(orders.map(o => o.externalCode).filter((code): code is string => code !== null));
  } catch (error) {
    console.error("Check external no exists error:", error);
    return new Set();
  }
}
