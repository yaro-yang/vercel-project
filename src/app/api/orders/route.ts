import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/types";

/**
 * GET /api/orders - 获取订单列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") as OrderStatus | null;

    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: "insensitive" } },
        { externalCode: { contains: search, mode: "insensitive" } },
        { receiverName: { contains: search, mode: "insensitive" } },
        { receiverPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    // 忽略 "ALL" 值，表示全部状态
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          orderNo: true,
          externalCode: true,
          senderName: true,
          senderPhone: true,
          senderAddress: true,
          receiverName: true,
          receiverPhone: true,
          receiverAddress: true,
          quantity: true,
          weight: true,
          temperature: true,
          remark: true,
          totalAmount: true,
          discount: true,
          finalAmount: true,
          status: true,
          source: true,
          templateId: true,
          batchId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { success: false, error: "获取订单列表失败" },
      { status: 500 }
    );
  }
}
