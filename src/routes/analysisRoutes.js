const express = require("express");
const fs = require("fs");
const path = require("path");

const { getUserData } = require("../utils/fileHelper");
const analyze = require("../services/analyzer");
const predict = require("../services/predictor");

const router = express.Router();

router.get("/:userId", (req, res) => {
  try {
    const userId = req.params.userId;

    // 1) Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // 2) Check if file exists
    const filePath = path.join(__dirname, "../../data/users", `${userId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "No data found for this user. Please upload CSV first.",
      });
    }

    // 3) Load user data
    const data = getUserData(userId);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User data is empty or invalid",
      });
    }

    // 4) Run analysis + prediction
    const analysis = analyze(data);
    const prediction = predict(data);

    // 5) Return response
    return res.status(200).json({
      success: true,
      userId,
      totalTransactions: data.length,
      analysis,
      prediction,
    });
  } catch (err) {
    console.error("Analysis Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
});

module.exports = router;
