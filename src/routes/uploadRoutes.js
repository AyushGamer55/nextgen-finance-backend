const express = require("express");
const multer = require("multer");
const fs = require("fs");

const parseCSV = require("../services/parser");
const { saveUserData } = require("../utils/fileHelper");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    const data = await parseCSV(req.file.path);

    // Normalize rows so analysis/prediction can be consistent and
    // support different CSV schemas (bank exports, Kaggle datasets, etc).
    const cleanedData = data.map((t) => {
      const rawAmount =
        t.amount ?? t.value ?? t.Amount ?? t.amt ?? t.transaction_amount ?? 0;

      const rawType =
        t.type ?? t.transaction_type ?? t.Type ?? t.txn_type ?? "";

      const rawCategory =
        t.category ?? t.spending_group ?? t.Category ?? t.CategoryName ?? "other";

      const typeStr = String(rawType).toLowerCase();
      const isIncome =
        typeStr.includes("income") ||
        typeStr.includes("credit") ||
        typeStr.includes("salary") ||
        typeStr.includes("deposit");

      return {
        ...t, // keep all original fields
        amount: Number(rawAmount) || 0,
        type: isIncome ? "income" : "expense",
        category: String(rawCategory).toLowerCase(),
      };
    });

    saveUserData(userId, cleanedData);

    // Cleanup temp file best-effort.
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    res.json({
      success: true,
      transactions: cleanedData.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
