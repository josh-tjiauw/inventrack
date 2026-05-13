const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BUSINESS_RULE_CONFLICT: 'BUSINESS_RULE_CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

const createApiError = ({ status = 500, code = API_ERROR_CODES.INTERNAL_ERROR, message, details }) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details) err.details = details;
  return err;
};

const validationError = (message, details) => createApiError({
  status: 400,
  code: API_ERROR_CODES.VALIDATION_ERROR,
  message,
  details
});

const conflictError = (message, details) => createApiError({
  status: 409,
  code: API_ERROR_CODES.BUSINESS_RULE_CONFLICT,
  message,
  details
});

const notFoundError = (message, details) => createApiError({
  status: 404,
  code: API_ERROR_CODES.NOT_FOUND,
  message,
  details
});

module.exports = {
  API_ERROR_CODES,
  createApiError,
  validationError,
  conflictError,
  notFoundError
};
