import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/orders/batch - 批量导入订单
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders, filename, templateId, templateName } = body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: "订单数据不能为空" },
        { status: 400 }
      );
    }

    const batchId = uuidv4();
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ row?: number; message: string }> = [];

    // 创建批次记录
    const batch = await prisma.importBatch.create({
      data: {
        id: batchId,
        filename: filename || "import.xlsx",
        templateId,
        templateName,
        totalCount: orders.length,
        status: "PROCESSING",
      },
    });

    // 批量处理订单
    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];

      try {
        // 生成唯一订单号
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
            weight: orderData.weight ? new Prisma.Decimal(orderData.weight) : null,
            temperature: orderData.temperature,
            remark: orderData.remark,
            templateId,
            batchId,
            status: "PENDING",
            rawData: orderData._raw as object,
          },
        });

        successCount++;
      } catch (err) {
        failedCount++;
        const errorMessage = err instanceof Error ? err.message : "未知错误";
        
        // 特殊处理重复外部编码
        if (errorMessage.includes("Unique constraint")) {
          errors.push({
            row: i + 1,
            message: `外部编码 "${orderData.externalCode}" 已存在`,
          });
        } else {
          errors.push({
            row: i + 1,
            message: errorMessage,
          });
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

    return NextResponse.json({
      success: failedCount === 0,
      batchId,
      successCount,
      failedCount,
      errors: errors.slice(0, 20), // 最多返回20条错误
    });
  } catch (error) {
    console.error("POST /api/orders/batch error:", error);
    return NextResponse.json(
      { success: false, error: "批量导入失败" },
      { status: 500 }
    );
  }
}
