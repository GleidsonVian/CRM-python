const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

files.forEach(f => {
  const csvPath = path.join(dir, f);
  const xlsxPath = path.join(dir, f.replace('.csv', '.xlsx'));
  
  const workbook = XLSX.readFile(csvPath);
  XLSX.writeFile(workbook, xlsxPath);
  console.log('Converted', f, 'to', xlsxPath);
});
