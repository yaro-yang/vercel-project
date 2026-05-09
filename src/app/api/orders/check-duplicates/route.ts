import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 分批查询，每批最大数量
const BATCH_SIZE = 500;

/**
 * POST /api/orders/check-duplicates - 检查外部编码是否已存在
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { externalCodes } = body;

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

    // 分批查询
    const allDuplicates: Array<{ externalCode: string; orderNo: string; status: string }> = [];

    for (let i = 0; i < validCodes.length; i += BATCH_SIZE) {
      const batch = validCodes.slice(i, i + BATCH_SIZE);

      const existingOrders = await prisma.order.findMany({
        where: {
          externalCode: {
            in: batch,
            mode: "insensitive",
          },
        },
        select: {
          externalCode: true,
          orderNo: true,
          status: true,
        },
      });

      allDuplicates.push(
        ...existingOrders.map((order) => ({
          externalCode: order.externalCode,
          orderNo: order.orderNo,
          status: order.status,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      duplicates: allDuplicates,
      count: allDuplicates.length,
      totalChecked: validCodes.length,
    });
  } catch (error) {
    console.error("POST /api/orders/check-duplicates error:", error);
    return NextResponse.json(
      { success: false, error: "检查重复失败" },
      { status: 500 }
    );
  }
}
