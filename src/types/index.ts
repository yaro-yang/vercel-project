// 导入和解析相关类型
export interface ParseError {
  type: "FILE_ERROR" | "VALIDATION_ERROR" | "DUPLICATE_ERROR";
  row?: number;
  field?: string;
  message: string;
}

export interface ParsedData {
  _rowIndex: number;
  _errors: ParseError[];
  _raw?: unknown[];
  _isModified?: boolean;
  _isNew?: boolean;
  
  // 运单字段
  externalCode?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  weight?: number;
  quantity?: number;
  temperature?: string;
  remark?: string;
  
  // 扩展字段
  [key: string]: unknown;
}

// 字段映射
export interface FieldMapping {
  [fieldKey: string]: string;
}

// 模板类型
export interface Template {
  id: string;
  name: string;
  description?: string;
  type: "STANDARD" | "EXPRESS" | "WHOLESALE" | "CUSTOM";
  mappings: FieldMapping;
  headers?: string[];
  fileType: "EXCEL" | "CSV" | "JSON";
  isActive: boolean;
  isDefault: boolean;
  presetKey?: string;
  createdAt: string;
  updatedAt: string;
}

// 运单/订单状态
export type OrderStatus = 
  | "PENDING" 
  | "CONFIRMED" 
  | "PROCESSING" 
  | "SHIPPED" 
  | "COMPLETED" 
  | "CANCELLED";

// 运单
export interface Order {
  id: string;
  orderNo: string;
  externalCode?: string;
  
  // 寄件人
  senderName: string;
  senderPhone?: string;
  senderAddress?: string;
  
  // 收件人
  receiverName: string;
  receiverPhone?: string;
  receiverAddress?: string;
  
  // 商品信息
  items?: OrderItem[];
  
  // 数量和重量
  quantity?: number;
  weight?: number;
  temperature?: string;
  remark?: string;
  
  // 金额
  totalAmount?: number;
  discount?: number;
  finalAmount?: number;
  
  // 状态
  status: OrderStatus;
  
  // 来源
  source?: string;
  templateId?: string;
  batchId?: string;
  
  // 原始数据
  rawData?: Record<string, unknown>;
  
  // 时间戳
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

// 导入批次
export interface ImportBatch {
  id: string;
  filename: string;
  templateId?: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errors?: ParseError[];
  createdAt: string;
  completedAt?: string;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分页结果
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 筛选参数
export interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  templateId?: string;
  startDate?: string;
  endDate?: string;
}

// 导入结果
export interface ImportResult {
  batchId: string;
  successCount: number;
  failedCount: number;
  errors: ParseError[];
}

// 表格列配置
export interface TableColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "select" | "phone" | "address";
  options?: string[];
  width?: number;
}

// ==================== 导入相关类型 ====================

// 温层选项
export const TEMP_LAYER_OPTIONS: { value: string; label: string }[] = [
  { value: "常温", label: "常温" },
  { value: "冷藏", label: "冷藏" },
  { value: "冷冻", label: "冷冻" },
  { value: "温控", label: "温控" },
]

// 模板映射
export interface TemplateMapping {
  [field: string]: string;
}

// 运单数据（导入预览用）
export interface WaybillData {
  id: string;
  tempId: string;
  rowIndex: number;
  externalNo?: string;
  orderNo?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  receiverName: string;
  receiverPhone?: string;
  receiverAddress?: string;
  receiverCity?: string;
  receiverDistrict?: string;
  goodsName?: string;
  goodsWeight?: number;
  goodsCount?: number;
  goodsVolume?: number;
  tempLayer?: string;
  totalAmount?: number;
  discount?: number;
  finalAmount?: number;
  remark?: string;
  rawData?: Record<string, unknown>;
  isValid: boolean;
  errors: ValidationError[];
  isDuplicate?: boolean;
  isExistingDuplicate?: boolean;
}

// 校验错误码
export type ValidationErrorCode =
  | "REQUIRED"
  | "PHONE_FORMAT"
  | "WEIGHT_INVALID"
  | "COUNT_INVALID"
  | "TEMP_LAYER_INVALID"
  | "DUPLICATE_EXTERNAL"
  | "EXTERNAL_EXISTS"
  | "ADDRESS_INVALID";

// 校验错误
export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
  row?: number;
}

// 导入进度
export interface ImportProgress {
  phase: "parsing" | "validating" | "saving" | "completed" | "error";
  current: number;
  total: number;
  message: string;
  percentage: number;
}

// 导入预览结果
export interface ImportPreview {
  waybills: WaybillData[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

// ==================== 运单字段定义 ====================

export interface WaybillField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "select" | "phone" | "address";
  options?: string[];
  width?: number;
}

export const WAYBILL_FIELDS: WaybillField[] = [
  { key: "externalNo", label: "外部编码", required: false },
  { key: "senderName", label: "寄件人", required: true },
  { key: "senderPhone", label: "寄件电话", required: false },
  { key: "senderAddress", label: "寄件地址", required: false },
  { key: "receiverName", label: "收件人", required: true },
  { key: "receiverPhone", label: "收件电话", required: false },
  { key: "receiverAddress", label: "收件地址", required: true },
  { key: "goodsName", label: "物品名称", required: false },
  { key: "goodsWeight", label: "重量(kg)", required: false, type: "number" },
  { key: "goodsCount", label: "件数", required: false, type: "number" },
  { key: "tempLayer", label: "温层", required: false, type: "select", options: ["常温", "冷藏", "冷冻", "温控"] },
  { key: "remark", label: "备注", required: false },
]

export type WaybillFieldKey = WaybillField["key"]

// ==================== 解析结果类型 ====================

export interface ParsedRow {
  rowIndex?: number
  data?: Record<string, string>
  errors?: ParseError[]
  [key: string]: unknown
}

export interface ParseResult {
  headers: string[]
  rows?: ParsedRow[]
  totalRows?: number
  successRows?: number
  errorRows?: number
  sheetName?: string
  data?: ParsedData[]
  errors?: ParseError[]
  rawData?: unknown[][]
  headerRow?: number
  sheetNames?: string[]
  autoDetectedSheet?: number
}

// ==================== 导入错误类型 ====================

export interface ImportError {
  row: number
  field: string
  message: string
  code: string
}

// ==================== 创建订单输入 ====================

export interface CreateOrderInput {
  orderNo?: string
  externalCode?: string
  senderName: string
  senderPhone?: string
  senderAddress?: string
  receiverName: string
  receiverPhone?: string
  receiverAddress?: string
  quantity?: number
  weight?: number | string
  temperature?: string
  remark?: string
  totalAmount?: number | string
  discount?: number | string
  finalAmount?: number | string
  rawData?: Record<string, unknown>
  source?: string
  templateId?: string
  batchId?: string
  items?: { name: string; quantity: number; price?: number }[]
}
