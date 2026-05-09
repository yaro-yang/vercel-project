import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/orders/check-duplicates - 检查外部编码是否已存在
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { externalCodes } = body;

    if (!Array.isArray(externalCodes) || externalCodes.length === 0) {
      return NextResponse.json({
        success: true,
        duplicates: [],
      });
    }

    // 过滤掉空值
    const validCodes = externalCodes.filter((code: string) => code && String(code).trim());

    if (validCodes.length === 0) {
      return NextResponse.json({
        success: true,
        duplicates: [],
      });
    }

    // 查询数据库中已存在的外部编码
    const existingOrders = await prisma.order.findMany({
      where: {
        externalCode: {
          in: validCodes,
          mode: "insensitive",
        },
      },
      select: {
        externalCode: true,
        orderNo: true,
        status: true,
      },
    });

    // 返回已存在的外部编码及其订单信息
    const duplicates = existingOrders.map((order) => ({
      externalCode: order.externalCode,
      orderNo: order.orderNo,
      status: order.status,
    }));

    return NextResponse.json({
      success: true,
      duplicates,
      count: duplicates.length,
    });
  } catch (error) {
    console.error("POST /api/orders/check-duplicates error:", error);
    return NextResponse.json(
      { success: false, error: "检查重复失败" },
      { status: 500 }
    );
  }
}
