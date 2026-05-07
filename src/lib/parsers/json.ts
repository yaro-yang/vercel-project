import { ParseResult, ParsedRow } from '@/types'

export async function parseJSON(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        // 支持数组或对象
        let jsonData: Record<string, unknown>[]
        if (Array.isArray(data)) {
          jsonData = data
        } else if (typeof data === 'object' && data !== null) {
          // 如果是对象，尝试获取数组属性
          const arrayProp = Object.values(data).find(v => Array.isArray(v))
          jsonData = (arrayProp as Record<string, unknown>[]) || [data]
        } else {
          throw new Error('JSON 格式不支持')
        }
        
        // 获取表头
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : []
        
        // 转换为 ParsedRow 格式
        const rows: ParsedRow[] = jsonData.map((row) => {
          const parsedRow: ParsedRow = {}
          headers.forEach((header) => {
            const value = row[header]
            if (typeof value === 'object' && value !== null) {
              parsedRow[header] = JSON.stringify(value)
            } else {
              parsedRow[header] = value as string | number | null
            }
          })
          return parsedRow
        })
        
        resolve({
          headers,
          rows,
          sheetName: 'data',
        })
      } catch (error) {
        reject(new Error(`JSON 解析失败: ${error instanceof Error ? error.message : '未知错误'}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    
    reader.readAsText(file)
  })
}
