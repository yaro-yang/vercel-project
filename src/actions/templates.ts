"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FieldMapping } from "@/types";

/**
 * 获取所有模板
 */
export async function getTemplates() {
  try {
    const templates = await prisma.template.findMany({
      where: { isActive: true },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        mappings: t.mappings as FieldMapping,
        headers: t.headers as string[] | undefined,
        fileType: t.fileType,
        isActive: t.isActive,
        isDefault: t.isDefault,
        presetKey: t.presetKey,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Get templates error:", error);
    return { success: false, error: "获取模板列表失败", data: [] };
  }
}

/**
 * 获取单个模板
 */
export async function getTemplate(id: string) {
  try {
    const template = await prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return { success: false, error: "模板不存在" };
    }

    return {
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        mappings: template.mappings as FieldMapping,
        headers: template.headers as string[] | undefined,
        fileType: template.fileType,
        isActive: template.isActive,
        isDefault: template.isDefault,
        presetKey: template.presetKey,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Get template error:", error);
    return { success: false, error: "获取模板失败" };
  }
}

/**
 * 创建模板
 */
export async function createTemplate(data: {
  name: string;
  description?: string;
  type?: "STANDARD" | "EXPRESS" | "WHOLESALE" | "CUSTOM";
  mappings: FieldMapping;
  headers?: string[];
  fileType?: "EXCEL" | "CSV" | "JSON";
  isDefault?: boolean;
  presetKey?: string;
}) {
  try {
    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await prisma.template.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type || "CUSTOM",
        mappings: data.mappings as object,
        headers: data.headers as unknown as object[],
        fileType: data.fileType || "EXCEL",
        isDefault: data.isDefault || false,
        presetKey: data.presetKey,
      },
    });

    revalidatePath("/orders/import");
    revalidatePath("/templates");

    return { success: true, data: template };
  } catch (error) {
    console.error("Create template error:", error);
    return { success: false, error: "创建模板失败" };
  }
}

/**
 * 更新模板
 */
export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    type?: "STANDARD" | "EXPRESS" | "WHOLESALE" | "CUSTOM";
    mappings?: FieldMapping;
    headers?: string[];
    isActive?: boolean;
    isDefault?: boolean;
  }
) {
  try {
    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await prisma.template.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type && { type: data.type }),
        ...(data.mappings && { mappings: data.mappings as object }),
        ...(data.headers && { headers: data.headers as unknown as object[] }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    revalidatePath("/orders/import");
    revalidatePath("/templates");

    return { success: true, data: template };
  } catch (error) {
    console.error("Update template error:", error);
    return { success: false, error: "更新模板失败" };
  }
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string) {
  try {
    await prisma.template.delete({
      where: { id },
    });

    revalidatePath("/orders/import");
    revalidatePath("/templates");

    return { success: true };
  } catch (error) {
    console.error("Delete template error:", error);
    return { success: false, error: "删除模板失败" };
  }
}

/**
 * 根据表头指纹查找匹配的模板
 */
export async function findMatchingTemplate(headers: string[]): Promise<{
  template: { id: string; name: string; mappings: FieldMapping } | null;
  similarity: number;
} | null> {
  try {
    const templates = await prisma.template.findMany({
      where: { isActive: true },
    });

    if (templates.length === 0) return null;

    // 计算每个模板的匹配度
    const matches = templates
      .map((t) => {
        const templateHeaders = t.headers as string[] || [];
        const similarity = calculateHeaderSimilarity(headers, templateHeaders);
        return { template: t, similarity };
      })
      .filter((m) => m.similarity > 0.3); // 相似度超过 30% 才匹配

    if (matches.length === 0) return null;

    // 返回最佳匹配
    const best = matches.sort((a, b) => b.similarity - a.similarity)[0];

    return {
      template: {
        id: best.template.id,
        name: best.template.name,
        mappings: best.template.mappings as FieldMapping,
      },
      similarity: best.similarity,
    };
  } catch (error) {
    console.error("Find matching template error:", error);
    return null;
  }
}

/**
 * 计算表头相似度
 */
function calculateHeaderSimilarity(headers1: string[], headers2: string[]): number {
  if (headers1.length === 0 || headers2.length === 0) return 0;

  const normalize = (s: string) => s.toLowerCase().trim();
  const set1 = new Set(headers1.map(normalize));
  const set2 = new Set(headers2.map(normalize));

  // Jaccard 相似度
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 初始化预设模板
 */
export async function initPresetTemplates() {
  const presetTemplates = [
    {
      name: "标准运单",
      description: "通用快递运单格式",
      type: "STANDARD" as const,
      presetKey: "standard",
      mappings: {
        externalCode: "外部编码",
        senderName: "寄件人",
        senderPhone: "寄件电话",
        senderAddress: "寄件地址",
        receiverName: "收件人",
        receiverPhone: "收件电话",
        receiverAddress: "收件地址",
        weight: "重量",
        quantity: "件数",
        temperature: "温层",
        remark: "备注",
      },
      headers: ["外部编码", "寄件人", "寄件电话", "寄件地址", "收件人", "收件电话", "收件地址", "重量", "件数", "温层", "备注"],
    },
    {
      name: "快递单",
      description: "快递公司标准格式",
      type: "EXPRESS" as const,
      presetKey: "express",
      mappings: {
        externalCode: "订单号",
        senderName: "发件人",
        senderPhone: "发件人电话",
        senderAddress: "发件地址",
        receiverName: "收件人姓名",
        receiverPhone: "收件人电话",
        receiverAddress: "收件人地址",
        weight: "预估重量",
        quantity: "包裹数量",
        temperature: "温区",
        remark: "备注说明",
      },
      headers: ["订单号", "发件人", "发件人电话", "发件地址", "收件人姓名", "收件人电话", "收件人地址", "预估重量", "包裹数量", "温区", "备注说明"],
    },
    {
      name: "生鲜配送",
      description: "冷链配送专用格式",
      type: "WHOLESALE" as const,
      presetKey: "fresh",
      mappings: {
        externalCode: "编号",
        senderName: "发货方",
        senderPhone: "发货电话",
        senderAddress: "发货地址",
        receiverName: "收货人",
        receiverPhone: "收货电话",
        receiverAddress: "收货地址",
        weight: "总重量",
        quantity: "总件数",
        temperature: "温控要求",
        remark: "特殊说明",
      },
      headers: ["编号", "发货方", "发货电话", "发货地址", "收货人", "收货电话", "收货地址", "总重量", "总件数", "温控要求", "特殊说明"],
    },
  ];

  try {
    for (const preset of presetTemplates) {
      // 检查是否已存在
      const existing = await prisma.template.findUnique({
        where: { presetKey: preset.presetKey },
      });

      if (!existing) {
        await prisma.template.create({
          data: {
            name: preset.name,
            description: preset.description,
            type: preset.type,
            presetKey: preset.presetKey,
            mappings: preset.mappings,
            headers: preset.headers,
            fileType: "EXCEL",
            isDefault: preset.presetKey === "standard",
            isActive: true,
          },
        });
      }
    }

    revalidatePath("/orders/import");
    return { success: true };
  } catch (error) {
    console.error("Init preset templates error:", error);
    return { success: false, error: "初始化预设模板失败" };
  }
}
