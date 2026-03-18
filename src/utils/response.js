// Success response helper
const successResponse = (res, message, data = null, statusCode = 200) => {
    const response = {
      success: true,
      message
    };
  
    if (data !== null) {
      response.data = data;
    }
  
    return res.status(statusCode).json(response);
  };
  
  // Error response helper
  const errorResponse = (res, message, statusCode = 400, errors = null) => {
    const response = {
      success: false,
      message
    };
  
    if (errors) {
      response.errors = errors;
    }
  
    return res.status(statusCode).json(response);
  };
  
  module.exports = {
    successResponse,
    errorResponse
  };