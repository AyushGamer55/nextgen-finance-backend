const { successResponse } = require('../utils/response');
const { getMlInsightsForUser } = require('../services/mlInsightsService');

const getMyAnalysis = async (req, res, next) => {
  try {
    const result = await getMlInsightsForUser(req.user._id);

    return successResponse(res, 'ML financial analysis generated successfully', {
      monthlyDataset: result.monthlyRows,
      currentFeatures: result.currentRow,
      ml: result.ml,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyAnalysis,
};
