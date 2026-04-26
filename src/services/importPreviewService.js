const crypto = require('crypto');
const TransactionService = require('./transactionService');

const previewStore = new Map();
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function cleanupExpiredPreviews() {
  const now = Date.now();
  for (const [key, value] of previewStore.entries()) {
    if (value.expiresAt <= now) {
      previewStore.delete(key);
    }
  }
}

function buildImportPreview(rows = []) {
  const acceptedRows = [];
  const skippedRows = [];
  let inferredCategoryCount = 0;

  rows.forEach((row, index) => {
    const result = TransactionService.inspectImportedTransaction(row);
    if (!result.accepted) {
      skippedRows.push({
        rowNumber: index + 2,
        reason: result.reason,
        raw: row,
      });
      return;
    }

    if (result.inferredCategory) {
      inferredCategoryCount += 1;
    }

    acceptedRows.push({
      rowNumber: index + 2,
      raw: row,
      normalized: result.transaction,
      inferredCategory: result.inferredCategory,
    });
  });

  const previewId = crypto.randomUUID();
  const summary = {
    totalRows: rows.length,
    acceptedRows: acceptedRows.length,
    skippedRows: skippedRows.length,
    inferredCategories: inferredCategoryCount,
  };

  cleanupExpiredPreviews();
  previewStore.set(previewId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    acceptedRows,
    skippedRows,
    summary,
  });

  return {
    previewId,
    acceptedRows,
    skippedRows,
    summary,
  };
}

function getPreview(previewId) {
  cleanupExpiredPreviews();
  const preview = previewStore.get(previewId);
  if (!preview) {
    return null;
  }
  return preview;
}

function consumePreview(previewId) {
  const preview = getPreview(previewId);
  if (!preview) {
    return null;
  }

  previewStore.delete(previewId);
  return preview;
}

module.exports = {
  buildImportPreview,
  getPreview,
  consumePreview,
};
