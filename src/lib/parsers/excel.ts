"use client";

import * as XLSX from "xlsx";
import type { ParsedData, ParseError, FieldMapping } from "@/types";

// 扩展字段别名映射 - 支持更多变体（包括所有测试模板的格式）
export const FIELD_ALIASES: Record<string, string[]> = {
  // 外部编码
  externalCode: [
    "外部编码", "订单号", "订单编号", "单号", "编号", "ID", "id", "No", "no", 
    "运单号", "快递单号", "外部订单号", "客户单号", "Ref Code", "ref code",
    "Reference", "Order No", "Order Number", "外部订单号", "客户单号",
    "外部订单号", "客户单号", "订单编号"
  ],
  
  // 寄件人
  senderName: [
    "寄件人", "发件人", "发货人", "Sender", "From", "寄件人姓名", "发件人姓名",
    "发货人姓名", "发件方", "发货方", "sender name", "from name", "发货人",
    "寄件人", "发件人"
  ],
  
  // 寄件电话
  senderPhone: [
    "寄件电话", "发件电话", "寄件人电话", "发件人电话", "Sender Phone", "From Phone", 
    "寄件手机", "发件手机", "发货电话", "发货人电话", "Sender Tel", "sender tel",
    "发件方电话", "发货方电话", "发件人电话", "发货电话"
  ],
  
  // 寄件地址
  senderAddress: [
    "寄件地址", "发件地址", "寄件人地址", "发件人地址", "Sender Address", "From Address",
    "发货地址", "发货人地址", "发件方地址", "sender address", "Sender Addr", 
    "发件人地址", "发货地址"
  ],
  
  // 收件人
  receiverName: [
    "收件人", "收货人", "收方", "Receiver", "To", "收件人姓名", "收货人姓名", 
    "联系人", "receiver name", "to name", "Receiver Name", "收货方", "收件方",
    "收货人", "收件人"
  ],
  
  // 收件电话
  receiverPhone: [
    "收件电话", "收货电话", "收件人电话", "收货人电话", "Receiver Phone", "To Phone", 
    "联系电话", "手机", "电话", "Receiver Tel", "receiver tel", "收货人手机",
    "收件人手机", "receiver phone", "收货方电话", "收件方电话", "收货电话"
  ],
  
  // 收件地址
  receiverAddress: [
    "收件地址", "收货地址", "收件人地址", "收货人地址", "Receiver Address", "To Address", 
    "地址", "详细地址", "receiver address", "Receiver Addr", "收货方地址", "收件方地址",
    "收货地址", "收件地址"
  ],
  
  // 重量
  weight: [
    "重量", "Weight", "kg", "KG", "千克", "公斤", "预估重量", "weight(kg)", 
    "Weight(kg)", "重量(kg)", "重量(KG)", "weight", "总重量", "货物重量"
  ],
  
  // 件数/数量
  quantity: [
    "件数", "数量", "Quantity", "件", "个数", "包裹数", "包裹数量", "qty", "Qty",
    "QTY", "数量", "总件数", "总数量", "货物件数", "商品数量"
  ],
  
  // 温层
  temperature: [
    "温层", "温度", "Temperature", "温控", "温区", "冷链类型", "温度要求",
    "Temp Zone", "temp zone", "温度 Zone", "温控要求", "温度要求", "温层类型"
  ],
  
  // 备注
  remark: [
    "备注", "Note", "Notes", "说明", "留言", "附言", "note", "notes", 
    "Remark", "remark", "备注说明", "特殊说明", "附言", "备注"
  ],
};

// 标准字段定义
export const STANDARD_FIELDS = [
  { key: "externalCode", label: "外部编码", required: false },
  { key: "senderName", label: "寄件人姓名", required: true },
  { key: "senderPhone", label: "寄件人电话", required: true },
  { key: "senderAddress", label: "寄件地址", required: false },
  { key: "receiverName", label: "收件人姓名", required: true },
  { key: "receiverPhone", label: "收件人电话", required: true },
  { key: "receiverAddress", label: "收件地址", required: true },
  { key: "weight", label: "重量", required: true },
  { key: "quantity", label: "件数", required: true },
  { key: "temperature", label: "温层", required: true },
  { key: "remark", label: "备注", required: false },
];

// 温层可选值
export const TEMPERATURE_OPTIONS = ["常温", "冷藏", "冷冻", "深冷", "恒温"];

export interface ParseOptions {
  sheetIndex?: number;
  headerRow?: number;
  fieldMapping?: FieldMapping;
  onProgress?: (progress: { percent: number; current: number; total: number }) => void;
}

/**
 * 检测表头行位置
 * 智能识别表头行（处理有说明行、合并单元格等情况）
 */
export function detectHeaderRow(jsonData: unknown[][]): number {
  if (jsonData.length === 0) return 0;
  
  // 遍历前15行，找到最可能是表头的那一行
  for (let i = 0; i < Math.min(15, jsonData.length); i++) {
    const row = jsonData[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    
    // 检查这一行是否包含多个字段别名
    let matchCount = 0;
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== "");
    const rowStr = row.map((cell) => String(cell || "").toLowerCase().trim()).join(" ");
    
    for (const aliases of Object.values(FIELD_ALIASES)) {
      for (const alias of aliases) {
        if (rowStr.includes(alias.toLowerCase())) {
          matchCount++;
          break;
        }
      }
    }
    
    // 如果匹配到4个或以上字段，认为是表头行
    if (matchCount >= 4) {
      return i;
    }
    
    // 特殊处理：如果这一行有至少6个非空单元格，且包含"姓名"或"名称"等关键词
    if (nonEmptyCells.length >= 6) {
      const hasFieldKeywords = rowStr.includes("姓名") || rowStr.includes("电话") || 
                               rowStr.includes("地址") || rowStr.includes("重量") ||
                               rowStr.includes("Sender") || rowStr.includes("Receiver") ||
                               rowStr.includes("Ref") || rowStr.includes("数量");
      if (hasFieldKeywords && matchCount >= 2) {
        return i;
      }
    }
  }
  
  // 默认返回第0行
  return 0;
}

/**
 * 清理表头文本（去除合并单元格带来的空值）
 */
export function cleanHeaders(rawHeaders: unknown[]): string[] {
  const headers: string[] = [];
  let lastNonEmpty = "";
  
  for (const h of rawHeaders) {
    const str = String(h || "").trim();
    if (str) {
      lastNonEmpty = str;
      headers.push(str);
    } else {
      // 如果是空值，使用上一个非空值（处理合并单元格）
      headers.push(lastNonEmpty);
    }
  }
  
  return headers;
}

/**
 * 解析 Excel 文件
 */
export async function parseExcel(
  file: File,
  options: ParseOptions = {}
): Promise<{ 
  data: ParsedData[]; 
  errors: ParseError[]; 
  headers: string[]; 
  rawData: unknown[][];
  headerRow: number;
  sheetNames: string[];
  autoDetectedSheet?: number;
}> {
  const { sheetIndex = -1, onProgress } = options; // sheetIndex = -1 表示自动检测
  const errors: ParseError[] = [];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 20); // 读取占 20%
        onProgress({ percent, current: e.loaded, total: e.total });
      }
    };

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          errors.push({ type: "FILE_ERROR", message: "文件读取失败" });
          resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: [] });
          return;
        }

        // 解析 workbook
        const workbook = XLSX.read(data, { type: "binary" });
        
        if (workbook.SheetNames.length === 0) {
          errors.push({ type: "FILE_ERROR", message: "Excel 文件中没有工作表" });
          resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: [] });
          return;
        }

        // 自动检测最佳工作表
        let targetSheetIndex = sheetIndex;
        if (targetSheetIndex === -1 || targetSheetIndex >= workbook.SheetNames.length) {
          targetSheetIndex = findBestDataSheet(workbook);
        }
        
        // 如果指定了 sheetIndex 但超出范围，使用自动检测的结果
        if (sheetIndex !== -1 && sheetIndex < workbook.SheetNames.length) {
          targetSheetIndex = sheetIndex;
        }

        const sheetName = workbook.SheetNames[targetSheetIndex];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          errors.push({ type: "FILE_ERROR", message: `工作表 "${sheetName}" 不存在` });
          resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: workbook.SheetNames });
          return;
        }

        // 转换为 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];

        if (jsonData.length === 0) {
          errors.push({ type: "FILE_ERROR", message: "工作表为空" });
          resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: workbook.SheetNames });
          return;
        }

        // 智能检测表头行
        const headerRow = detectHeaderRow(jsonData);
        
        // 提取并清理表头
        const rawHeaders = jsonData[headerRow];
        const headers = cleanHeaders(rawHeaders);
        
        // 提取数据行（表头之后）
        const rawDataRows = jsonData.slice(headerRow + 1).filter((row) => 
          row.some((cell) => cell !== "" && cell !== null && cell !== undefined)
        );

        if (rawDataRows.length === 0) {
          errors.push({ type: "FILE_ERROR", message: "没有有效的数据行" });
          resolve({ data: [], errors, headers, rawData: [], headerRow, sheetNames: workbook.SheetNames });
          return;
        }

        if (onProgress) {
          onProgress({ percent: 40, current: 40, total: 100 });
        }

        resolve({ 
          data: [],
          errors, 
          headers, 
          rawData: rawDataRows,
          headerRow,
          sheetNames: workbook.SheetNames,
          autoDetectedSheet: targetSheetIndex,
        });

      } catch (error) {
        errors.push({ 
          type: "FILE_ERROR", 
          message: error instanceof Error ? error.message : "解析 Excel 失败" 
        });
        resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: [] });
      }
    };

    reader.onerror = () => {
      errors.push({ type: "FILE_ERROR", message: "文件读取错误" });
      resolve({ data: [], errors, headers: [], rawData: [], headerRow: 0, sheetNames: [] });
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * 自动检测最佳数据工作表
 * 跳过说明性质的Sheet，选择包含数据的Sheet
 */
function findBestDataSheet(workbook: XLSX.WorkBook): number {
  const sheetNames = workbook.SheetNames;
  
  // 如果只有一个Sheet，直接返回
  if (sheetNames.length === 1) return 0;
  
  // 排除包含说明、readme等关键词的Sheet
  const skipKeywords = ["说明", "readme", "guide", "help", "instruction", "模板说明", "填写说明"];
  const dataSheetIndices: number[] = [];
  
  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i].toLowerCase();
    const shouldSkip = skipKeywords.some(keyword => name.includes(keyword.toLowerCase()));
    if (!shouldSkip) {
      dataSheetIndices.push(i);
    }
  }
  
  // 如果排除了说明Sheet后只剩一个，返回那个
  if (dataSheetIndices.length === 1) {
    return dataSheetIndices[0];
  }
  
  // 如果全部被排除了，返回第一个
  if (dataSheetIndices.length === 0) {
    return 0;
  }
  
  // 找到包含最多数据行且有明确表头的Sheet
  let bestIndex = dataSheetIndices[0];
  let maxScore = 0;
  
  for (const idx of dataSheetIndices) {
    const worksheet = workbook.Sheets[sheetNames[idx]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
    const headerRow = detectHeaderRow(jsonData);
    const dataRows = jsonData.slice(headerRow + 1).filter((row) => 
      row.some((cell) => cell !== "" && cell !== null && cell !== undefined)
    );
    
    // 提取表头
    const rawHeaders = jsonData[headerRow];
    const headers = cleanHeaders(rawHeaders);
    
    // 计算匹配分数：数据行数 * 10 + 字段匹配数
    const mapping = autoMatchFields(headers);
    const matchCount = Object.keys(mapping).length;
    const score = dataRows.length * 10 + matchCount;
    
    if (score > maxScore) {
      maxScore = score;
      bestIndex = idx;
    }
  }
  
  return bestIndex;
}

/**
 * 自动匹配字段映射 - 增强版，支持模糊匹配
 */
export function autoMatchFields(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const matchedHeaders = new Set<string>();
  const matchedFields = new Set<string>();

  // 第一轮：精确匹配
  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (matchedFields.has(fieldKey)) continue;
    
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();
      
      if (aliases.includes(header) || aliases.includes(normalizedHeader)) {
        mapping[fieldKey] = header;
        matchedHeaders.add(header);
        matchedFields.add(fieldKey);
        break;
      }
    }
  }

  // 第二轮：包含匹配
  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (matchedFields.has(fieldKey)) continue;
    
    for (const header of headers) {
      if (matchedHeaders.has(header)) continue;
      
      const normalizedHeader = header.toLowerCase().trim();
      
      const isMatch = aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase().trim();
        return (
          normalizedHeader === normalizedAlias ||
          normalizedHeader.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedHeader)
        );
      });

      if (isMatch) {
        mapping[fieldKey] = header;
        matchedHeaders.add(header);
        matchedFields.add(fieldKey);
        break;
      }
    }
  }

  // 第三轮：相似度匹配（处理英文缩写等）
  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (matchedFields.has(fieldKey)) continue;
    
    for (const header of headers) {
      if (matchedHeaders.has(header)) continue;
      
      const normalizedHeader = header.toLowerCase().trim().replace(/[\s\-_]/g, "");
      
      const isSimilar = aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase().trim().replace(/[\s\-_]/g, "");
        // 编辑距离或相似度判断
        return (
          normalizedHeader === normalizedAlias ||
          (normalizedHeader.length > 3 && normalizedAlias.length > 3 &&
           (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)))
        );
      });

      if (isSimilar) {
        mapping[fieldKey] = header;
        matchedHeaders.add(header);
        matchedFields.add(fieldKey);
        break;
      }
    }
  }

  return mapping;
}

/**
 * 生成表头指纹（用于模板记忆）
 */
export function generateHeaderFingerprint(headers: string[]): string {
  return headers
    .map((h) => h.toLowerCase().trim())
    .sort()
    .join("|");
}

/**
 * 计算表头相似度
 */
export function calculateSimilarity(headers1: string[], headers2: string[]): number {
  const set1 = new Set(headers1.map((h) => h.toLowerCase().trim()));
  const set2 = new Set(headers2.map((h) => h.toLowerCase().trim()));
  
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 应用字段映射转换数据
 */
export function applyFieldMapping(
  rawData: unknown[][],
  headers: string[],
  mapping: FieldMapping,
  onProgress?: (progress: { percent: number; current: number; total: number }) => void
): ParsedData[] {
  const result: ParsedData[] = [];
  const total = rawData.length;

  // 创建反向映射：Excel列名 -> 字段key
  const reverseMapping: Record<string, string> = {};
  for (const [fieldKey, headerName] of Object.entries(mapping)) {
    reverseMapping[headerName] = fieldKey;
  }

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowData: ParsedData = {
      _rowIndex: i + 1,
      _errors: [],
      _raw: row,
    };

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const fieldKey = reverseMapping[header];
      
      if (fieldKey) {
        rowData[fieldKey] = row[colIndex];
      }
    }

    result.push(rowData);

    if (onProgress && i % 100 === 0) {
      const percent = 40 + Math.round(((i + 1) / total) * 60);
      onProgress({ percent, current: i + 1, total });
    }
  }

  if (onProgress) {
    onProgress({ percent: 100, current: total, total });
  }

  return result;
}

/**
 * 验证单条数据
 */
export function validateRow(row: ParsedData, rowIndex: number): ParseError[] {
  const errors: ParseError[] = [];

  // 必填校验（外部编码改为选填）
  const requiredFields = [
    { key: "senderName", label: "寄件人姓名" },
    { key: "senderPhone", label: "寄件人电话" },
    { key: "receiverName", label: "收件人姓名" },
    { key: "receiverPhone", label: "收件人电话" },
    { key: "receiverAddress", label: "收件地址" },
    { key: "weight", label: "重量" },
    { key: "quantity", label: "件数" },
    { key: "temperature", label: "温层" },
  ];

  for (const field of requiredFields) {
    const value = row[field.key];
    if (value === undefined || value === null || value === "") {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: field.key,
        message: `${field.label}为必填项`,
      });
    }
  }

  // 电话格式校验（更宽松）
  const phoneRegex = /^1[3-9]\d{9}$/;
  const loosePhoneRegex = /^\d{11}$/;
  
  if (row.senderPhone) {
    const phone = String(row.senderPhone).replace(/\s/g, "").replace(/-/g, "");
    if (!phoneRegex.test(phone) && !loosePhoneRegex.test(phone)) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "senderPhone",
        message: "寄件人电话格式错误，应为11位手机号",
      });
    }
  }

  if (row.receiverPhone) {
    const phone = String(row.receiverPhone).replace(/\s/g, "").replace(/-/g, "");
    if (!phoneRegex.test(phone) && !loosePhoneRegex.test(phone)) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "receiverPhone",
        message: "收件人电话格式错误，应为11位手机号",
      });
    }
  }

  // 重量校验（正数）
  if (row.weight !== undefined && row.weight !== null) {
    const weight = parseFloat(String(row.weight));
    if (isNaN(weight) || weight <= 0) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "weight",
        message: "重量必须为正数",
      });
    }
  }

  // 件数校验（正整数）
  if (row.quantity !== undefined && row.quantity !== null) {
    const quantity = parseInt(String(row.quantity), 10);
    if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(Number(row.quantity))) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "quantity",
        message: "件数必须为正整数",
      });
    }
  }

  // 温层校验
  if (row.temperature && !TEMPERATURE_OPTIONS.includes(String(row.temperature))) {
    errors.push({
      type: "VALIDATION_ERROR",
      row: rowIndex,
      field: "temperature",
      message: `温层值必须在 [${TEMPERATURE_OPTIONS.join(", ")}] 范围内`,
    });
  }

  return errors;
}

/**
 * 批量验证数据
 */
export function validateAllData(data: ParsedData[]): { validData: ParsedData[]; allErrors: ParseError[] } {
  const allErrors: ParseError[] = [];
  const validData: ParsedData[] = [];

  // 检测重复的外部编码
  const externalCodeMap = new Map<string, number[]>();

  for (const row of data) {
    if (row.externalCode) {
      const code = String(row.externalCode).trim();
      if (code) {
        const existing = externalCodeMap.get(code) || [];
        existing.push(row._rowIndex);
        externalCodeMap.set(code, existing);
      }
    }
  }

  for (const row of data) {
    const errors = validateRow(row, row._rowIndex);

    // 检查外部编码重复
    if (row.externalCode) {
      const code = String(row.externalCode).trim();
      if (code) {
        const indices = externalCodeMap.get(code) || [];
        if (indices.length > 1) {
          const otherIndices = indices.filter((i) => i !== row._rowIndex);
          errors.push({
            type: "DUPLICATE_ERROR",
            row: row._rowIndex,
            field: "externalCode",
            message: `外部编码与第 ${otherIndices.join(", ")} 行重复`,
          });
        }
      }
    }

    row._errors = errors;
    allErrors.push(...errors);

    if (errors.length === 0) {
      validData.push(row);
    }
  }

  return { validData, allErrors };
}

/**
 * 导出数据为 Excel
 */
export function exportToExcel(data: ParsedData[], filename: string): void {
  const headers = [
    "外部编码", "寄件人姓名", "寄件人电话", "寄件地址",
    "收件人姓名", "收件人电话", "收件地址",
    "重量", "件数", "温层", "备注"
  ];

  const rows = data.map((row) => [
    row.externalCode || "",
    row.senderName || "",
    row.senderPhone || "",
    row.senderAddress || "",
    row.receiverName || "",
    row.receiverPhone || "",
    row.receiverAddress || "",
    row.weight || "",
    row.quantity || "",
    row.temperature || "",
    row.remark || "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  
  XLSX.writeFile(workbook, filename);
}
