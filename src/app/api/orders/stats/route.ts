import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/orders/stats - 获取订单统计
 */
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, pending, processing, completed, todayCount] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, pending, processing, completed, todayCount },
    });
  } catch (error) {
    console.error("GET /api/orders/stats error:", error);
    return NextResponse.json(
      { success: false, error: "获取统计数据失败" },
      { status: 500 }
    );
  }
}
