import express from "express";
import xlsx from "xlsx";
import cors from "cors";
import dotenv from "dotenv";
import db from "./db.js";
import fs from "fs/promises";
import upload from "./middleware/upload.js";

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend in running...")
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
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Just send preview to frontend
    res.json({ success: true, preview: rows });

  } catch (err) {
    console.error("Error uploading SKUs:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ✅ SSE route for real-time progress - Phase 1 Working
// app.get("/submit-skus-stream", upload.single("file"), async (req, res) => {
//   const payload = JSON.parse(req.query.payload); // frontend sends JSON in query
//   const { vendorCode, createdBy, skus } = payload;
//   let filePath = req.query.filePath; // optional if frontend uploaded file

//   if (!Array.isArray(skus)) {
//     res.status(400).end();
//     return;
//   }

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   const skippedSkus = [];
//   const insertedSkus = [];
//   const errors = [];

//   const cleanNumber = (value) => {
//     if (!value) return null;
//     const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
//     return isNaN(num) ? null : num;
//   };

//   try {
//     await db.query("START TRANSACTION");

//     let processed = 0;
//     const total = skus.length;

//     for (const sku of skus) {
//       processed++;

//       try {
//         const skuCode = sku["SKU Code"]?.toString().trim();
//         if (!skuCode) continue;

//         // 1️⃣ Check if SKU exists
//         const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
//         if (existingSku) {
//           skippedSkus.push(skuCode);
//           res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
//           continue;
//         }

//         // 2️⃣ Extract SKU fields
//         const name = sku["Product Title"]?.toString().trim() || null;
//         const category = sku["Category"]?.toString().trim() || null;
//         const subCategory = sku["Sub Category"]?.toString().trim() || null;
//         const hsn = sku["HSN"]?.toString().trim() || null;
//         const modelNumber = sku["Model Number"]?.toString().trim() || null;
//         const mrp = cleanNumber(sku["MRP"]);
//         const sapCode = sku["SAP Code"]?.toString().trim() || null;
//         const gst = cleanNumber(sku["GST(%)"]);

//         // Dimensions
//         const size = sku["Size"]?.toString().trim() || null;
//         const colorFamilycolor = sku["Color Family"]?.toString().trim() || null;
//         const length = cleanNumber(sku["Prdct L(cm)"]);
//         const breadth = cleanNumber(sku["Prdct B(cm)"]);
//         const height = cleanNumber(sku["Prdct H(cm)"]);
//         const weight = cleanNumber(sku["Wght(kg)"]);
//         const masterCartonQty = cleanNumber(sku["MC Qty"]);
//         const masterCartonLengthCm = cleanNumber(sku["MC L(cm)"]);
//         const masterCartonBreadthCm = cleanNumber(sku["MC B(cm)"]);
//         const masterCartonHeightCm = cleanNumber(sku["MC H(cm)"]);
//         const masterCartonWeightKg = cleanNumber(sku["MC Wght(kg)"]);

//         // 3️⃣ Insert SKU
//         const [skuResult] = await db.query(
//           `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
//            VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
//           [skuCode, name, vendorCode]
//         );
//         const skuId = skuResult.insertId;

//         // 4️⃣ Insert SKU details
//         const [detailsResult] = await db.query(
//           `INSERT INTO sku_details
//            (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
//            VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
//           [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
//         );
//         const skuDetailsId = detailsResult.insertId;

//         // 5️⃣ Insert SKU dimensions
//         if (length || breadth || height || weight || size || colorFamilycolor || masterCartonQty) {
//           await db.query(
//             `INSERT INTO sku_dimensions (
//               size, colorFamilycolor,
//               productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//               masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//               skuDetailsId, createdAt, updatedAt
//             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
//             [
//               size, colorFamilycolor,
//               length, breadth, height, weight,
//               masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//               skuDetailsId
//             ]
//           );
//         }

//         // 6️⃣ Create inventory row
//         await db.query(`INSERT INTO inventory (skuId, quantity) VALUES (?, 0)`, [skuId]);

//         insertedSkus.push(skuCode);
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

//       } catch (err) {
//         errors.push({ skuCode: sku["SKU Code"], error: err.message });
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
//       }
//     }

//     await db.query("COMMIT");

//     // ✅ Send final report
//     res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
//     res.end();

//   } catch (err) {
//     await db.query("ROLLBACK");
//     console.error("🔥 SSE Fatal error:", err);
//     res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
//     res.end();
//   } finally {
//     if (filePath) {
//       try { await fs.unlink(filePath); } catch {}
//     }
//   }
// });

// ✅ SSE route for real-time progress - Phase 2 Working
// app.get("/submit-skus-stream", upload.single("file"), async (req, res) => {
//   const payload = JSON.parse(req.query.payload); 
//   const { vendorCode, createdBy, skus } = payload;
//   // let filePath = req.query.filePath; 

//   if (!Array.isArray(skus)) {
//     res.status(400).end();
//     return;
//   }

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   const skippedSkus = [];
//   const insertedSkus = [];
//   const errors = [];

//   const cleanNumber = (value) => {
//     if (!value) return null;
//     const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
//     return isNaN(num) ? null : num;
//   };

//   try {
//     await db.query("START TRANSACTION");

//     let processed = 0;
//     const total = skus.length;

//     for (const sku of skus) {
//       processed++;

//       try {
//         const skuCode = sku["SKU Code"]?.toString().trim();
//         if (!skuCode) continue;

//         const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
//         if (existingSku) {
//           skippedSkus.push(skuCode);
//           res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
//           continue;
//         }

//         const name = sku["Product Title"]?.toString().trim() || null;
//         const category = sku["Category"]?.toString().trim() || null;
//         const subCategory = sku["Sub Category"]?.toString().trim() || null;
//         const hsn = sku["HSN"]?.toString().trim() || null;
//         const modelNumber = sku["Model Number"]?.toString().trim() || null;
//         const mrp = cleanNumber(sku["MRP"]);
//         const sapCode = sku["SAP Code"]?.toString().trim() || null;
//         const gst = cleanNumber(sku["GST(%)"]);

//         const size = sku["Size"]?.toString().trim() || null;
//         const colorFamilycolor = sku["Color Family"]?.toString().trim() || null;
//         const length = cleanNumber(sku["Prdct L(cm)"]);
//         const breadth = cleanNumber(sku["Prdct B(cm)"]);
//         const height = cleanNumber(sku["Prdct H(cm)"]);
//         const weight = cleanNumber(sku["Wght(kg)"]);
//         const masterCartonQty = cleanNumber(sku["MC Qty"]);
//         const masterCartonLengthCm = cleanNumber(sku["MC L(cm)"]);
//         const masterCartonBreadthCm = cleanNumber(sku["MC B(cm)"]);
//         const masterCartonHeightCm = cleanNumber(sku["MC H(cm)"]);
//         const masterCartonWeightKg = cleanNumber(sku["MC Wght(kg)"]);

//         const [skuResult] = await db.query(
//           `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
//            VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
//           [skuCode, name, vendorCode]
//         );
//         const skuId = skuResult.insertId;

//         const [detailsResult] = await db.query(
//           `INSERT INTO sku_details
//            (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
//            VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
//           [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
//         );
//         const skuDetailsId = detailsResult.insertId;

//         if (length || breadth || height || weight || size || colorFamilycolor || masterCartonQty) {
//           await db.query(
//             `INSERT INTO sku_dimensions (
//               size, colorFamilycolor,
//               productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//               masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//               skuDetailsId, createdAt, updatedAt
//             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
//             [
//               size, colorFamilycolor,
//               length, breadth, height, weight,
//               masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//               skuDetailsId
//             ]
//           );
//         }

//         await db.query(`INSERT INTO inventory (skuId, quantity) VALUES (?, 0)`, [skuId]);

//         insertedSkus.push(skuCode);
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

//       } catch (err) {
//         errors.push({ skuCode: sku["SKU Code"], error: err.message });
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
//       }
//     }

//     // ✅ Run your extra INSERT ... SELECT to fill missing dimensions
//     await db.query(`
//       INSERT INTO sku_dimensions (
//         size, colorFamilycolor, productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//         masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//         skuDetailsId, createdAt, updatedAt
//       )
//       SELECT 
//           NULL, NULL, NULL, NULL, NULL, NULL,
//           NULL, NULL, NULL, NULL, NULL,
//           sd.id, NOW(), NOW()
//       FROM sku_details sd
//       LEFT JOIN sku_dimensions d ON d.skuDetailsId = sd.id
//       WHERE d.id IS NULL;
//     `);

//     await db.query("COMMIT");

//     res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
//     res.end();

//   } catch (err) {
//     await db.query("ROLLBACK");
//     console.error("🔥 SSE Fatal error:", err);
//     res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
//     res.end();
//   // } finally {
//   //   if (filePath) {
//   //     try { await fs.unlink(filePath); } catch {}
//   //   }
//   }
// });

// ✅ SSE route for real-time progress - Phase 3 Testing
app.get("/submit-skus-stream", upload.single("file"), async (req, res) => {
  const payload = JSON.parse(req.query.payload);
  const { vendorCode, createdBy, skus } = payload;

  if (!Array.isArray(skus)) {
    res.status(400).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const skippedSkus = [];
  const insertedSkus = [];
  const errors = [];

  const cleanNumber = (value) => {
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
    return isNaN(num) ? null : num;
  };

  try {
    await db.query("START TRANSACTION");

    let processed = 0;
    const total = skus.length;

    for (const sku of skus) {
      processed++;

      try {
        const skuCode = sku["SKU Code"]?.toString().trim();
        if (!skuCode) continue;

        const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
        if (existingSku) {
          skippedSkus.push(skuCode);
          res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
          continue;
        }

        const name = sku["Product Title"]?.toString().trim() || null;
        const category = sku["Category"]?.toString().trim() || null;
        const subCategory = sku["Sub Category"]?.toString().trim() || null;
        const hsn = sku["HSN"]?.toString().trim() || null;
        const modelNumber = sku["Model Number"]?.toString().trim() || null;
        const mrp = cleanNumber(sku["MRP"]);
        const sapCode = sku["SAP Code"]?.toString().trim() || null;
        const gst = cleanNumber(sku["GST(%)"]);

        const size = sku["Size"]?.toString().trim() || null;
        const colorFamilycolor = sku["Color Family"]?.toString().trim() || null;
        const length = cleanNumber(sku["Prdct L(cm)"]);
        const breadth = cleanNumber(sku["Prdct B(cm)"]);
        const height = cleanNumber(sku["Prdct H(cm)"]);
        const weight = cleanNumber(sku["Wght(kg)"]);
        const masterCartonQty = cleanNumber(sku["MC Qty"]);
        const masterCartonLengthCm = cleanNumber(sku["MC L(cm)"]);
        const masterCartonBreadthCm = cleanNumber(sku["MC B(cm)"]);
        const masterCartonHeightCm = cleanNumber(sku["MC H(cm)"]);
        const masterCartonWeightKg = cleanNumber(sku["MC Wght(kg)"]);

        const [skuResult] = await db.query(
          `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
           VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
          [skuCode, name, vendorCode]
        );
        const skuId = skuResult.insertId;

        const [detailsResult] = await db.query(
          `INSERT INTO sku_details
           (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
          [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
        );
        const skuDetailsId = detailsResult.insertId;

        if (length || breadth || height || weight || size || colorFamilycolor || masterCartonQty) {
          await db.query(
            `INSERT INTO sku_dimensions (
              size, colorFamilycolor,
              productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
              masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
              skuDetailsId, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              size, colorFamilycolor,
              length, breadth, height, weight,
              masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
              skuDetailsId
            ]
          );
        }

        // ✅ Always create 5 inventory slots for this SKU
        const slotPromises = [];
        for (let i = 1; i <= 5; i++) {
          const batchId = `${skuCode}_slot_${i}`;
          slotPromises.push(
            db.query(
              `INSERT INTO inventory (skuId, batchId, quantity, expiryDate)
               VALUES (?, ?, 0, NULL)`,
              [skuId, batchId]
            )
          );
        }
        await Promise.all(slotPromises);

        insertedSkus.push(skuCode);
        res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

      } catch (err) {
        errors.push({ skuCode: sku["SKU Code"], error: err.message });
        res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
      }
    }

    // ✅ Fill missing dimensions if any
    await db.query(`
      INSERT INTO sku_dimensions (
        size, colorFamilycolor, productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
        masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
        skuDetailsId, createdAt, updatedAt
      )
      SELECT 
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL, NULL,
          sd.id, NOW(), NOW()
      FROM sku_details sd
      LEFT JOIN sku_dimensions d ON d.skuDetailsId = sd.id
      WHERE d.id IS NULL;
    `);

    await db.query("COMMIT");

    res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
    res.end();

  } catch (err) {
    await db.query("ROLLBACK");
    console.error("🔥 SSE Fatal error:", err);
    res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
    res.end();
  }
});

// Phase 6 - Testing with Real Time Progress
// app.post("/submit-skus", upload.single("file"), async (req, res) => {
//   const filePath = req.file?.path;
//   try {
//     const { vendorCode, createdBy, skus } = req.body;

//     if (!Array.isArray(skus)) {
//       return res.status(400).json({ message: "Invalid data format. 'skus' must be an array" });
//     }

//     // Setup SSE (Server-Sent Events)
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     const total = skus.length;
//     let processed = 0;
//     const skippedSkus = [];
//     const insertedSkus = [];
//     const errors = [];

//     await db.query("START TRANSACTION");

//     const cleanNumber = (value) => {
//       if (!value) return null;
//       const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
//       return isNaN(num) ? null : num;
//     };

//     for (const sku of skus) {
//       processed++;

//       try {
//         const skuCode = sku["SKU Code"]?.toString().trim();
//         if (!skuCode) continue;

//         const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
//         if (existingSku) {
//           skippedSkus.push(skuCode);
//           res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
//           continue;
//         }

//         // --- insert logic (exactly your code, unchanged) ---
//         const name = sku["Product Title"]?.toString().trim() || null;
//         const category = sku["Category"]?.toString().trim() || null;
//         const subCategory = sku["Sub Category"]?.toString().trim() || null;
//         const hsn = sku["HSN"]?.toString().trim() || null;
//         const modelNumber = sku["Model Number"]?.toString().trim() || null;
//         const mrp = cleanNumber(sku["MRP"]);
//         const sapCode = sku["SAP Code"]?.toString().trim() || null;
//         const gst = cleanNumber(sku["GST(%)"]);

//         const length = cleanNumber(sku["Prdct L(cm)"]);
//         const breadth = cleanNumber(sku["Prdct B(cm)"]);
//         const height = cleanNumber(sku["Prdct H(cm)"]);
//         const weight = cleanNumber(sku["Wght(kg)"]);

//         const [skuResult] = await db.query(
//           `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
//            VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
//           [skuCode, name, vendorCode]
//         );
//         const skuId = skuResult.insertId;

//         const [detailsResult] = await db.query(
//           `INSERT INTO sku_details 
//            (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
//            VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
//           [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
//         );
//         const skuDetailsId = detailsResult.insertId;

//         if (length || breadth || height || weight) {
//           await db.query(
//             `INSERT INTO sku_dimensions (
//               productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//               skuDetailsId, createdAt, updatedAt
//             )
//             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
//             [length, breadth, height, weight, skuDetailsId]
//           );
//         }

//         await db.query(`INSERT INTO inventory (skuId, quantity) VALUES (?, 0)`, [skuId]);

//         insertedSkus.push(skuCode);
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

//       } catch (err) {
//         errors.push({ skuCode: sku["SKU Code"], error: err.message });
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
//       }
//     }

//     await db.query("COMMIT");

//     // Send final result
//     res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
//     res.end();

//   } catch (err) {
//     await db.query("ROLLBACK");
//     res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
//     res.end();
//   } finally {
//     if (filePath) {
//       try { await fs.unlink(filePath); } catch {}
//     }
//   }
// });

// Phase 7 - Working with Real Time Progress
// app.post("/submit-skus", upload.single("file"), async (req, res) => {
//   // const filePath = req.file?.path;
//   try {
//     const { vendorCode, createdBy, skus } = req.body;

//     if (!Array.isArray(skus)) {
//       return res.status(400).json({ message: "Invalid data format. 'skus' must be an array" });
//     }

//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     const total = skus.length;
//     let processed = 0;
//     const skippedSkus = [];
//     const insertedSkus = [];
//     const errors = [];

//     await db.query("START TRANSACTION");

//     const cleanNumber = (value) => {
//       if (!value) return null;
//       const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
//       return isNaN(num) ? null : num;
//     };

//     for (const sku of skus) {
//       processed++;

//       try {
//         const skuCode = sku["SKU Code"]?.toString().trim();
//         if (!skuCode) continue;

//         const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
//         if (existingSku) {
//           skippedSkus.push(skuCode);
//           res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
//           continue;
//         }

//         const name = sku["Product Title"]?.toString().trim() || null;
//         const category = sku["Category"]?.toString().trim() || null;
//         const subCategory = sku["Sub Category"]?.toString().trim() || null;
//         const hsn = sku["HSN"]?.toString().trim() || null;
//         const modelNumber = sku["Model Number"]?.toString().trim() || null;
//         const mrp = cleanNumber(sku["MRP"]);
//         const sapCode = sku["SAP Code"]?.toString().trim() || null;
//         const gst = cleanNumber(sku["GST(%)"]);

//         const length = cleanNumber(sku["Prdct L(cm)"]);
//         const breadth = cleanNumber(sku["Prdct B(cm)"]);
//         const height = cleanNumber(sku["Prdct H(cm)"]);
//         const weight = cleanNumber(sku["Wght(kg)"]);

//         const [skuResult] = await db.query(
//           `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
//            VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
//           [skuCode, name, vendorCode]
//         );
//         const skuId = skuResult.insertId;

//         const [detailsResult] = await db.query(
//           `INSERT INTO sku_details 
//            (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
//            VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
//           [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
//         );
//         const skuDetailsId = detailsResult.insertId;

//         if (length || breadth || height || weight) {
//           await db.query(
//             `INSERT INTO sku_dimensions (
//               productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//               skuDetailsId, createdAt, updatedAt
//             )
//             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
//             [length, breadth, height, weight, skuDetailsId]
//           );
//         }

//         await db.query(`INSERT INTO inventory (skuId, quantity) VALUES (?, 0)`, [skuId]);

//         insertedSkus.push(skuCode);
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

//       } catch (err) {
//         errors.push({ skuCode: sku["SKU Code"], error: err.message });
//         res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
//       }
//     }

//     // ✅ Run your extra INSERT ... SELECT to fill missing dimensions
//     await db.query(`
//       INSERT INTO sku_dimensions (
//         size, colorFamilycolor, productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
//         masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
//         skuDetailsId, createdAt, updatedAt
//       )
//       SELECT 
//           NULL, NULL, NULL, NULL, NULL, NULL,
//           NULL, NULL, NULL, NULL, NULL,
//           sd.id, NOW(), NOW()
//       FROM sku_details sd
//       LEFT JOIN sku_dimensions d ON d.skuDetailsId = sd.id
//       WHERE d.id IS NULL;
//     `);

//     await db.query("COMMIT");

//     res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
//     res.end();

//   } catch (err) {
//     await db.query("ROLLBACK");
//     res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
//     res.end();
//   // } finally {
//   //   if (filePath) {
//   //     try { await fs.unlink(filePath); } catch {}
//   //   }
//   }
// });

// Phase 8 - Testing with Real Time Progress and 5 slots logic
app.post("/submit-skus", upload.single("file"), async (req, res) => {
  try {
    const { vendorCode, createdBy, skus } = req.body;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ message: "Invalid data format. 'skus' must be an array" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const total = skus.length;
    let processed = 0;
    const skippedSkus = [];
    const insertedSkus = [];
    const errors = [];

    await db.query("START TRANSACTION");

    const cleanNumber = (value) => {
      if (!value) return null;
      const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
      return isNaN(num) ? null : num;
    };

    for (const sku of skus) {
      processed++;

      try {
        const skuCode = sku["SKU Code"]?.toString().trim();
        if (!skuCode) continue;

        const [[existingSku]] = await db.query("SELECT id FROM sku WHERE skuCode = ?", [skuCode]);
        if (existingSku) {
          skippedSkus.push(skuCode);
          res.write(`data: ${JSON.stringify({ progress: processed, total, status: "skipped", skuCode })}\n\n`);
          continue;
        }

        const name = sku["Product Title"]?.toString().trim() || null;
        const category = sku["Category"]?.toString().trim() || null;
        const subCategory = sku["Sub Category"]?.toString().trim() || null;
        const hsn = sku["HSN"]?.toString().trim() || null;
        const modelNumber = sku["Model Number"]?.toString().trim() || null;
        const mrp = cleanNumber(sku["MRP"]);
        const sapCode = sku["SAP Code"]?.toString().trim() || null;
        const gst = cleanNumber(sku["GST(%)"]);

        const length = cleanNumber(sku["Prdct L(cm)"]);
        const breadth = cleanNumber(sku["Prdct B(cm)"]);
        const height = cleanNumber(sku["Prdct H(cm)"]);
        const weight = cleanNumber(sku["Wght(kg)"]);

        const [skuResult] = await db.query(
          `INSERT INTO sku (skuCode, name, vendorId, isCombo, inventoryUpdatedAt)
           VALUES (?, ?, (SELECT id FROM vendor WHERE vendorCode=?), 0, NOW())`,
          [skuCode, name, vendorCode]
        );
        const skuId = skuResult.insertId;

        const [detailsResult] = await db.query(
          `INSERT INTO sku_details 
           (category, subCategory, hsn, modelNumber, mrp, isVerified, createdBy, skuId, createdAt, updatedAt, sapCode, gst)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), ?, ?)`,
          [category, subCategory, hsn, modelNumber, mrp, createdBy || "system", skuId, sapCode, gst]
        );
        const skuDetailsId = detailsResult.insertId;

        if (length || breadth || height || weight) {
          await db.query(
            `INSERT INTO sku_dimensions (
              productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
              skuDetailsId, createdAt, updatedAt
            )
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [length, breadth, height, weight, skuDetailsId]
          );
        }

        // Create 5 slots for the new SKU
        const slotPromises = [];
        for (let i = 1; i <= 5; i++) {
          const batchId = `${skuCode}_slot_${i}`;
          slotPromises.push(
            db.query(
              `INSERT INTO inventory (skuId, batchId, quantity, expiryDate)
               VALUES (?, ?, 0, NULL)`,
              [skuId, batchId]
            )
          );
        }
        await Promise.all(slotPromises);

        insertedSkus.push(skuCode);
        res.write(`data: ${JSON.stringify({ progress: processed, total, status: "inserted", skuCode })}\n\n`);

      } catch (err) {
        errors.push({ skuCode: sku["SKU Code"], error: err.message });
        res.write(`data: ${JSON.stringify({ progress: processed, total, status: "error", skuCode: sku["SKU Code"], error: err.message })}\n\n`);
      }
    }

    // ✅ Run your extra INSERT ... SELECT to fill missing dimensions
    await db.query(`
      INSERT INTO sku_dimensions (
        size, colorFamilycolor, productLengthCm, productBreadthCm, productHeightCm, productWeightKg,
        masterCartonQty, masterCartonLengthCm, masterCartonBreadthCm, masterCartonHeightCm, masterCartonWeightKg,
        skuDetailsId, createdAt, updatedAt
      )
      SELECT 
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, NULL, NULL,
          sd.id, NOW(), NOW()
      FROM sku_details sd
      LEFT JOIN sku_dimensions d ON d.skuDetailsId = sd.id
      WHERE d.id IS NULL;
    `);

    await db.query("COMMIT");

    res.write(`data: ${JSON.stringify({ done: true, inserted: insertedSkus, skipped: skippedSkus, errors })}\n\n`);
    res.end();

  } catch (err) {
    await db.query("ROLLBACK");
    res.write(`data: ${JSON.stringify({ done: true, error: err.message })}\n\n`);
    res.end();
  }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on http://localhost:"${PORT}`));
