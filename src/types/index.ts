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
