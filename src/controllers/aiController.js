const { errorResponse } = require('../utils/response');
const { getAdvisorReply } = require('../services/financialAdvisorService');
const { aiChatValidation } = require('../utils/validators');

const chatWithAdvisor = async (req, res, next) => {
  try {
    const { error, value } = aiChatValidation.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message, 400);
    }

    const { userId, message } = value;

    if (userId && String(userId) !== String(req.user._id)) {
      return errorResponse(res, 'User ID does not match the authenticated user', 403);
    }

    const result = await getAdvisorReply(req.user._id, String(message).trim());
    res.status(200).json({
      reply: result.reply,
      meta: result.meta || null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chatWithAdvisor,
};
