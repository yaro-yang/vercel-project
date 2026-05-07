import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/templates/match - 根据表头匹配模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headers } = body;

    if (!headers || !Array.isArray(headers)) {
      return NextResponse.json(
        { success: false, error: "无效的表头数据" },
        { status: 400 }
      );
    }

    const templates = await prisma.template.findMany({
      where: { isActive: true },
    });

    if (templates.length === 0) {
      return NextResponse.json({ success: true, template: null, similarity: 0 });
    }

    // 计算每个模板的匹配度
    const normalize = (s: string) => s.toLowerCase().trim();
    const inputSet = new Set(headers.map(normalize));

    const matches = templates
      .map((t) => {
        const templateHeaders = (t.headers as string[]) || [];
        const templateSet = new Set(templateHeaders.map(normalize));
        
        // Jaccard 相似度
        const intersection = new Set([...inputSet].filter((x) => templateSet.has(x)));
        const union = new Set([...inputSet, ...templateSet]);
        const similarity = intersection.size / union.size;

        return { template: t, similarity };
      })
      .filter((m) => m.similarity > 0.2);

    if (matches.length === 0) {
      return NextResponse.json({ success: true, template: null, similarity: 0 });
    }

    // 返回最佳匹配
    const best = matches.sort((a, b) => b.similarity - a.similarity)[0];

    return NextResponse.json({
      success: true,
      template: {
        id: best.template.id,
        name: best.template.name,
        mappings: best.template.mappings,
        headers: best.template.headers,
      },
      similarity: Math.round(best.similarity * 100),
    });
  } catch (error) {
    console.error("POST /api/templates/match error:", error);
    return NextResponse.json(
      { success: false, error: "模板匹配失败" },
      { status: 500 }
    );
  }
}
