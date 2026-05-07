import Papa from 'papaparse'
import { ParseResult, ParsedRow } from '@/types'

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    // 检查文件编码
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        
        if (!content || content.trim() === '') {
          reject(new Error('CSV 文件内容为空'))
          return
        }
        
        // 尝试检测编码
        let finalContent = content
        
        // 检查 BOM
        if (content.charCodeAt(0) === 0xFEFF) {
          finalContent = content.slice(1)
        }
        
        // 解析 CSV
        Papa.parse(finalContent, {
          encoding: 'UTF-8',
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            // 检查是否有错误
            if (results.errors && results.errors.length > 0) {
              const criticalError = results.errors.find(
                e => e.type === 'FieldMismatch' || e.type === 'Quotes' || e.type === 'Delimiter'
              )
              if (criticalError) {
                console.warn('CSV 解析警告:', criticalError.message)
              }
            }
            
            const headers = results.meta.fields || []
            
            if (headers.length === 0) {
              reject(new Error('无法读取 CSV 表头，请确保文件有正确的表头行'))
              return
            }
            
            if (results.data.length === 0) {
              reject(new Error('CSV 文件中没有数据行'))
              return
            }
            
            const rows: ParsedRow[] = results.data.map((row: Record<string, string>) => {
              const parsedRow: ParsedRow = {}
              headers.forEach((header) => {
                const value = row[header]
                if (value === undefined || value === null || value.trim() === '') {
                  parsedRow[header] = null
                } else {
                  parsedRow[header] = value.trim()
                }
              })
              return parsedRow
            })
            
            resolve({
              headers,
              rows,
              sheetName: 'Sheet1',
            })
          },
          error: (error) => {
            if (error.message.includes('CSV')) {
              reject(new Error(`CSV 解析失败: ${error.message}`))
            } else {
              reject(new Error('CSV 文件格式错误，请检查文件编码和分隔符'))
            }
          },
        })
      } catch (error) {
        reject(new Error('CSV 文件读取失败，请检查文件编码'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败，请检查文件是否损坏'))
    }
    
    try {
      reader.readAsText(file, 'UTF-8')
    } catch (error) {
      reject(new Error('无法读取文件，请检查文件格式'))
    }
  })
}
