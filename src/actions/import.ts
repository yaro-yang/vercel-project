import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import {
  WaybillData,
  ValidationError,
  ValidationErrorCode,
  TemplateMapping,
  ImportPreview,
  ImportProgress,
  TEMP_LAYER_OPTIONS,
} from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { checkExternalNoExists } from './orders'

// ==================== 校验逻辑 ====================

export function validateWaybill(
  wb: WaybillData,
  rowIndex: number,
  existingExternalNos: Set<string>,
  allExternalNos: Map<string, number[]>,
  isFirstBatch: boolean = true
): ValidationError[] {
  const errors: ValidationError[] = []

  // 必填字段校验
  if (!wb.receiverName?.trim()) {
    errors.push({
      field: 'receiverName',
      message: '收件人不能为空',
      code: 'REQUIRED',
    })
  }

  // 电话格式校验
  if (wb.receiverPhone?.trim()) {
    const phone = wb.receiverPhone.trim()
    const phoneRegex = /^1[3-9]\d{9}$/
    const phoneAltRegex = /^\d{3,4}-?\d{7,8}$/
    
    if (!phoneRegex.test(phone) && !phoneAltRegex.test(phone)) {
      errors.push({
        field: 'receiverPhone',
        message: '电话格式错误，应为手机号或固话',
        code: 'PHONE_FORMAT',
      })
    }
  }

  if (wb.senderPhone?.trim()) {
    const phone = wb.senderPhone.trim()
    const phoneRegex = /^1[3-9]\d{9}$/
    const phoneAltRegex = /^\d{3,4}-?\d{7,8}$/
    
    if (!phoneRegex.test(phone) && !phoneAltRegex.test(phone)) {
      errors.push({
        field: 'senderPhone',
        message: '寄件人电话格式错误',
        code: 'PHONE_FORMAT',
      })
    }
  }

  // 重量校验
  if (wb.goodsWeight !== undefined && wb.goodsWeight !== null) {
    if (typeof wb.goodsWeight !== 'number' || wb.goodsWeight < 0) {
      errors.push({
        field: 'goodsWeight',
        message: '重量必须为非负数',
        code: 'WEIGHT_INVALID',
      })
    }
  }

  // 件数校验
  if (wb.goodsCount !== undefined && wb.goodsCount !== null) {
    if (!Number.isInteger(wb.goodsCount) || wb.goodsCount < 1) {
      errors.push({
        field: 'goodsCount',
        message: '件数必须为正整数',
        code: 'COUNT_INVALID',
      })
    }
  }

  // 温层校验
  if (wb.tempLayer?.trim()) {
    const validLayers = TEMP_LAYER_OPTIONS.map(t => t.value)
    if (!validLayers.includes(wb.tempLayer.trim())) {
      errors.push({
        field: 'tempLayer',
        message: `温层值必须在 [${validLayers.join(', ')}] 范围内`,
        code: 'TEMP_LAYER_INVALID',
      })
    }
  }

  // 外部编码重复校验
  if (wb.externalNo?.trim()) {
    const externalNo = wb.externalNo.trim()
    
    // 检查批次内重复
    const duplicateRows = allExternalNos.get(externalNo)
    if (duplicateRows && duplicateRows.length > 1) {
      const otherRow = duplicateRows.find(r => r !== rowIndex)
      if (otherRow) {
        errors.push({
          field: 'externalNo',
          message: `与第 ${otherRow} 行外部编码重复`,
          code: 'DUPLICATE_EXTERNAL',
        })
      }
    }
    
    // 检查数据库已存在
    if (isFirstBatch && existingExternalNos.has(externalNo)) {
      errors.push({
        field: 'externalNo',
        message: '该外部编码已在系统中存在',
        code: 'EXTERNAL_EXISTS',
      })
    }
  }

  return errors
}

// ==================== 数据转换 ====================

// 将解析的原始行转换为运单数据
export function transformRowToWaybill(
  row: Record<string, unknown>,
  mappings: TemplateMapping,
  rowIndex: number
): WaybillData {
  const getValue = (field: string): string => {
    const key = mappings[field]
    if (!key) return ''
    return String(row[key] ?? '').trim()
  }

  const getNumericValue = (field: string): number | undefined => {
    const value = getValue(field)
    if (!value) return undefined
    const num = parseFloat(value)
    return isNaN(num) ? undefined : num
  }

  const getIntValue = (field: string): number | undefined => {
    const value = getValue(field)
    if (!value) return undefined
    const num = parseInt(value)
    return isNaN(num) ? undefined : num
  }

  return {
    id: uuidv4(),
    tempId: uuidv4(),
    rowIndex,
    externalNo: getValue('externalNo') || undefined,
    orderNo: getValue('orderNo') || undefined,
    senderName: getValue('senderName') || undefined,
    senderPhone: getValue('senderPhone') || undefined,
    senderAddress: getValue('senderAddress') || undefined,
    receiverName: getValue('receiverName'),
    receiverPhone: getValue('receiverPhone') || undefined,
    receiverAddress: getValue('receiverAddress') || undefined,
    receiverCity: getValue('receiverCity') || undefined,
    receiverDistrict: getValue('receiverDistrict') || undefined,
    goodsName: getValue('goodsName') || undefined,
    goodsWeight: getNumericValue('goodsWeight'),
    goodsCount: getIntValue('goodsCount'),
    goodsVolume: getNumericValue('goodsVolume'),
    tempLayer: getValue('tempLayer') || undefined,
    totalAmount: getNumericValue('totalAmount'),
    discount: getNumericValue('discount'),
    finalAmount: getNumericValue('finalAmount'),
    remark: getValue('remark') || undefined,
    rawData: row,
    isValid: true,
    errors: [],
    isDuplicate: false,
    isExistingDuplicate: false,
  }
}

// ==================== 预览导入数据 ====================

export async function previewImport(
  rows: Record<string, unknown>[],
  mappings: TemplateMapping,
  templateId?: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportPreview> {
  const total = rows.length
  const waybills: WaybillData[] = []
  const allErrors: ValidationError[] = []
  
  // 收集所有外部编码用于批次内重复检测
  const allExternalNos = new Map<string, number[]>()
  
  // 阶段1: 数据转换
  onProgress?.({
    phase: 'parsing',
    current: 0,
    total,
    message: '正在解析数据...',
    percentage: 0,
  })
  
  for (let i = 0; i < rows.length; i++) {
    const wb = transformRowToWaybill(rows[i], mappings, i + 1)
    waybills.push(wb)
    
    // 收集外部编码
    if (wb.externalNo?.trim()) {
      const existing = allExternalNos.get(wb.externalNo) || []
      existing.push(wb.rowIndex)
      allExternalNos.set(wb.externalNo, existing)
    }
    
    if (i % 100 === 0) {
      onProgress?.({
        phase: 'parsing',
        current: i + 1,
        total,
        message: `已解析 ${i + 1} / ${total} 行`,
        percentage: Math.round(((i + 1) / total) * 30),
      })
    }
  }
  
  // 阶段2: 校验
  onProgress?.({
    phase: 'validating',
    current: 0,
    total,
    message: '正在校验数据...',
    percentage: 30,
  })
  
  // 检查已存在的外部编码
  const existingExternalNos = await checkExternalNoExists(
    waybills.map(w => w.externalNo || '').filter(Boolean)
  )
  
  for (let i = 0; i < waybills.length; i++) {
    const wb = waybills[i]
    const errors = validateWaybill(wb, wb.rowIndex, existingExternalNos, allExternalNos, true)
    
    if (errors.length > 0) {
      wb.isValid = false
      wb.errors = errors
      
      // 标记重复
      for (const err of errors) {
        if (err.code === 'DUPLICATE_EXTERNAL') {
          wb.isDuplicate = true
        }
        if (err.code === 'EXTERNAL_EXISTS') {
          wb.isExistingDuplicate = true
        }
      }
      
      allErrors.push(...errors.map(e => ({ ...e, row: wb.rowIndex })))
    }
    
    if (i % 100 === 0) {
      onProgress?.({
        phase: 'validating',
        current: i + 1,
        total,
        message: `已校验 ${i + 1} / ${total} 行`,
        percentage: 30 + Math.round((i / total) * 50),
      })
    }
  }
  
  onProgress?.({
    phase: 'validating',
    current: total,
    total,
    message: '校验完成',
    percentage: 80,
  })
  
  const validRows = waybills.filter(w => w.isValid).length
  const duplicateRows = waybills.filter(w => w.isDuplicate || w.isExistingDuplicate).length
  
  return {
    waybills,
    errors: allErrors,
    totalRows: total,
    validRows,
    invalidRows: total - validRows,
    duplicateRows,
  }
}

// ==================== 更新预览数据中的运单 ====================

export function updateWaybillInPreview(
  waybills: WaybillData[],
  tempId: string,
  updates: Partial<WaybillData>
): WaybillData[] {
  return waybills.map(wb => {
    if (wb.tempId === tempId) {
      const updated = { ...wb, ...updates }
      
      // 清除关联错误
      const fieldsToCheck = Object.keys(updates) as (keyof WaybillData)[]
      updated.errors = updated.errors.filter(
        err => !fieldsToCheck.includes(err.field as keyof WaybillData)
      )
      updated.isValid = updated.errors.length === 0
      
      return updated
    }
    return wb
  })
}

// ==================== 删除预览数据中的运单 ====================

export function removeWaybillFromPreview(
  waybills: WaybillData[],
  tempId: string
): WaybillData[] {
  return waybills.filter(wb => wb.tempId !== tempId)
}

// ==================== 添加新行 ====================

export function addNewWaybillRow(waybills: WaybillData[]): WaybillData[] {
  const newRow: WaybillData = {
    id: uuidv4(),
    tempId: uuidv4(),
    rowIndex: waybills.length + 1,
    receiverName: '',
    isValid: true,
    errors: [],
    isDuplicate: false,
    isExistingDuplicate: false,
  }
  return [...waybills, newRow]
}
