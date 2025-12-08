import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const excelPath = path.join(__dirname, "../../base-ETH-TEL-16 (2).xlsx");

try {
  const workbook = XLSX.readFile(excelPath);
  
  console.log("Available sheets:", workbook.SheetNames);
  console.log("\n");
  
  // Read all sheets
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Total rows: ${data.length}`);
    
    if (data.length > 0) {
      console.log("\nFirst row (headers):");
      console.log(data[0]);
      
      if (data.length > 1) {
        console.log("\nSecond row (sample data):");
        console.log(data[1]);
      }
      
      if (data.length > 2) {
        console.log("\nThird row (sample data):");
        console.log(data[2]);
      }
    }
  }
} catch (error) {
  console.error("Error reading Excel file:", error);
  console.log("\nPlease ensure the file exists at:", excelPath);
}
