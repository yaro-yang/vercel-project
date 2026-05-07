import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FieldMapping } from "@/types";

/**
 * GET /api/templates - 获取所有模板
 */
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      where: { isActive: true },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        mappings: t.mappings,
        headers: t.headers,
        fileType: t.fileType,
        isActive: t.isActive,
        isDefault: t.isDefault,
        presetKey: t.presetKey,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json(
      { success: false, error: "获取模板列表失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates - 创建模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, mappings, headers, fileType, isDefault, presetKey } = body;

    if (!name || !mappings) {
      return NextResponse.json(
        { success: false, error: "模板名称和映射配置不能为空" },
        { status: 400 }
      );
    }

    // 如果设为默认，先取消其他默认
    if (isDefault) {
      await prisma.template.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.template.create({
      data: {
        name,
        description,
        type: type || "CUSTOM",
        mappings: mappings as object,
        headers: headers as object[],
        fileType: fileType || "EXCEL",
        isDefault: isDefault || false,
        presetKey,
      },
    });

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        mappings: template.mappings,
        headers: template.headers,
        fileType: template.fileType,
        isActive: template.isActive,
        isDefault: template.isDefault,
        presetKey: template.presetKey,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json(
      { success: false, error: "创建模板失败" },
      { status: 500 }
    );
  }
}
