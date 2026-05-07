const XLSX = require('xlsx');
const path = require('path');

const templates = [
  'template1-standard.xlsx',
  'template2-ecommerce.xlsx', 
  'template3-english.xlsx',
  'template4-grouped.xlsx',
  'template5-multisheet.xlsx'
];

for (const tmpl of templates) {
  const filePath = path.join('/tmp/excel_templates', tmpl);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`模板: ${tmpl}`);
  console.log('='.repeat(60));
  
  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`工作表数量: ${workbook.SheetNames.length}`);
    console.log(`工作表名称: ${workbook.SheetNames.join(', ')}`);
    
    workbook.SheetNames.forEach((sheetName, idx) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      console.log(`\n--- Sheet ${idx + 1}: ${sheetName} ---`);
      console.log(`总行数: ${jsonData.length}`);
      
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (Array.isArray(row) && row.some(c => c !== '')) {
          console.log(`行 ${i}: ${JSON.stringify(row)}`);
        }
      }
    });
  } catch (err) {
    console.log(`读取失败: ${err.message}`);
  }
}
