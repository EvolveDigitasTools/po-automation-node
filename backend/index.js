import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// Default route (index.html will load automatically)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Dynamically generate & download Sample SKU Sheet
app.get("/download-sample-sku", (req, res) => {
  try {
    // 1️⃣ Define headers (keys) and column widths
    const headers = [
      "SKU Code",
      "Category",
      "Sub Category",
      "Product Title",
      "SAP Code",
      "HSN",
      "EAN",
      "Model Number",
      "Size",
      "Color",
      "Prdct L(cm)",
      "Prdct B(cm)",
      "Prdct H(cm)",
      "Wght(kg)",
      "MSTRCTN Box Qty",
      "MSTRCTN L(cm)",
      "MSTRCTN B(cm)",
      "MSTRCTN H(cm)",
      "MSTRCTN Wght(kg)",
      "MRP",
      "GST(%)"
    ];

    // Create an object with empty values just to get headers in first row
    const emptyRow = {};
    headers.forEach(h => emptyRow[h] = "");

    // 2️⃣ Create a new workbook and sheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet([emptyRow], { skipHeader: false });

    // 3️⃣ Set column widths
    worksheet["!cols"] = [
      { wch: 15 }, // SKU Code
      { wch: 20 }, // Category
      { wch: 15 }, // Sub Category
      { wch: 30 }, // Product Title
      { wch: 15 }, // SAP Code
      { wch: 15 }, // HSN
      { wch: 15 }, // EAN
      { wch: 15 }, // Model Number
      { wch: 15 }, // Size
      { wch: 15 }, // Color
      { wch: 15 }, // Prdct L(cm)
      { wch: 15 }, // Prdct B(cm)
      { wch: 15 }, // Prdct H(cm)
      { wch: 15 }, // Wght(kg)
      { wch: 15 }, // MSTRCTN Box Qty
      { wch: 15 }, // MSTRCTN L(cm)
      { wch: 15 }, // MSTRCTN B(cm)
      { wch: 15 }, // MSTRCTN H(cm)
      { wch: 15 }, // MSTRCTN Wght(kg)
      { wch: 15 }, // MRP
      { wch: 15 }  // GST(%)
    ];

    // 4️⃣ Append sheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, "SampleSKU");

    // 5️⃣ Write file to buffer (in memory)
    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    // 6️⃣ Send buffer as downloadable file
    res.setHeader("Content-Disposition", "attachment; filename=Sample_SKU_Sheet.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);

  } catch (err) {
    console.error("Error generating sample SKU sheet:", err);
    res.status(500).send("Could not generate sample file");
  }
});

// ✅ Get Vendors + Categories - Currenly working
app.get("/vendors", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT vendorCode, companyName, productCategory FROM vendor"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ message: "Database query failed" });
  }
});

// ✅ Upload SKU Sheet & preview - Phase 1 - Currently working
app.post("/upload-sku", upload.single("skuFile"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Just send preview to frontend
    res.json({ success: true, preview: rows });

  } catch (err) {
    console.error("Error uploading SKUs:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ✅ Final Submit (Save SKUs to DB)
app.post("/submit-skus", async (req, res) => {
  try {
    const { vendorCode, createdBy, skus } = req.body;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ message: "Invalid data format. 'skus' must be an array" });
    }

    // Begin transaction
    await db.query("START TRANSACTION");

    for (const sku of skus) {
      const skuCode = sku["SKU Code"]?.toString().trim();
      if (!skuCode) {
        console.warn("⚠️ Skipping row without SKU Code:", sku);
        continue;
      }

      const name = sku["Product Title"]?.toString().trim() || null;
      const category = sku["Category"]?.toString().trim() || null;
      const subCategory = sku["Sub Category"]?.toString().trim() || null;
      const hsn = sku["HSN"]?.toString().trim() || null;
      const modelNumber = sku["Model Number"]?.toString().trim() || null;
      const mrp = sku["MRP"] ?? null;
      const sapCode = sku["SAP Code"]?.toString().trim() || null;
      const gst = sku["GST(%)"] ?? null;

      // optional dimensions
      const length = sku["Prdct L(cm)"] ?? null;
      const breadth = sku["Prdct B(cm)"] ?? null;
      const height = sku["Prdct H(cm)"] ?? null;
      const weight = sku["Wght(kg)"] ?? null;

      // 1️⃣ Insert or update SKU
      const [skuResult] = await db.query(
        `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
         VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), vendorId=VALUES(vendorId), inventoryUpdatedAt=NOW()`,
        [skuCode, name, vendorCode]
      );

      let skuId = skuResult.insertId;
      if (!skuId) {
        const [[existing]] = await db.query("SELECT id FROM sku WHERE skuCode=?", [skuCode]);
        skuId = existing.id;
      }

      // 2️⃣ Insert or update SKU details
      const [detailsResult] = await db.query(
        `INSERT INTO sku_details 
         (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE
           category=VALUES(category), subCategory=VALUES(subCategory), hsn=VALUES(hsn),
           modelNumber=VALUES(modelNumber), mrp=VALUES(mrp), gst=VALUES(gst), updatedAt=NOW()`,
        [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
      );

      let skuDetailsId = detailsResult.insertId;
      if (!skuDetailsId) {
        const [[existingDetails]] = await db.query("SELECT id FROM sku_details WHERE skuId=?", [skuId]);
        skuDetailsId = existingDetails?.id;
      }

      // 3️⃣ Insert or update SKU dimensions (if provided)
      // if (length || breadth || height || weight) {
      //   await db.query(
      //     `INSERT INTO sku_dimensions (skuDetailsId, length, breadth, height, weight)
      //      VALUES (?, ?, ?, ?, ?)
      //      ON DUPLICATE KEY UPDATE
      //        length=VALUES(length), breadth=VALUES(breadth), height=VALUES(height), weight=VALUES(weight)`,
      //     [skuDetailsId, length, breadth, height, weight]
      //   );
      // }

      // 4️⃣ Ensure inventory exists for this SKU (set to 0 if not exists)
      await db.query(
        `INSERT INTO inventory (skuId, quantity)
         VALUES (?, 0)
         ON DUPLICATE KEY UPDATE quantity=quantity`,
        [skuId]
      );
    }

    await db.query("COMMIT");
    res.json({ success: true, message: "SKUs inserted/updated successfully" });

  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error inserting SKUs:", err);
    res.status(500).json({ message: "Error inserting SKUs", error: err.message });
  }
});


app.listen(4000, () => console.log("Server running on http://localhost:4000"));
