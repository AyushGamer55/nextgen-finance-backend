const express = require("express");
const multer = require("multer");
const fs = require("fs");

const parseCSV = require("../services/parser");
const TransactionService = require("../services/transactionService");
const { buildImportPreview, consumePreview } = require("../services/importPreviewService");
const { generateCsvContent } = require("../../generate");

const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, cb) {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      /\.csv$/i.test(file.originalname || '');

    if (!isCsv) {
      return cb(new Error('Only CSV files are allowed'));
    }

    return cb(null, true);
  },
});

router.use(protect);

router.get("/generate", (req, res) => {
  try {
    const rows = Math.max(1, Number(req.query.rows || 500));
    const features = Math.max(0, Number(req.query.features || 4));
    const result = generateCsvContent({ rows, features });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${rows}-rows.csv"`);
    res.status(200).send(result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/preview", upload.single("file"), async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    tempFilePath = req.file.path;
    const data = await parseCSV(req.file.path);
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "CSV file is empty or unreadable" });
    }

    res.json({
      success: true,
      data: buildImportPreview(data),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }
  }
});

router.post("/confirm", async (req, res) => {
  try {
    const { previewId } = req.body || {};
    if (!previewId) {
      return res.status(400).json({ message: "previewId is required" });
    }

    const preview = consumePreview(previewId);
    if (!preview) {
      return res.status(404).json({ message: "Preview expired or not found" });
    }

    const importedTransactions = await TransactionService.replaceUserTransactionsFromImport(
      req.user._id,
      preview.acceptedRows.map((row) => row.normalized),
    );

    res.json({
      success: true,
      data: {
        previewId,
        summary: preview.summary,
        importedCount: importedTransactions.length,
        transactions: importedTransactions,
        skippedRows: preview.skippedRows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
