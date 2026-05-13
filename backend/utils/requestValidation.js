const { validationError } = require('./apiErrors');

const getFirstDefined = (source, keys) => {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
};

const normalizeString = (value) => String(value || '').trim();

const optionalInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const validateRequestBody = (body, schema) => {
  const output = {};
  const errors = [];

  for (const field of schema) {
    const keys = [field.key, ...(field.aliases || [])];
    const rawValue = getFirstDefined(body, keys);
    const missing = rawValue === undefined || rawValue === null || rawValue === '';
    const value = missing && field.default !== undefined ? field.default : rawValue;

    if ((value === undefined || value === null || value === '') && field.required) {
      errors.push({ field: field.key, message: `${field.label || field.key} is required` });
      continue;
    }

    if (value === undefined || value === null || value === '') {
      output[field.key] = field.nullable ? null : undefined;
      continue;
    }

    if (field.type === 'positiveInt') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        errors.push({ field: field.key, message: `${field.label || field.key} must be a positive integer` });
      } else {
        output[field.key] = parsed;
      }
      continue;
    }

    if (field.type === 'nonNegativeInt') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push({ field: field.key, message: `${field.label || field.key} must be a non-negative integer` });
      } else {
        output[field.key] = parsed;
      }
      continue;
    }

    if (field.type === 'string') {
      const normalized = normalizeString(value);
      if (field.required && !normalized) {
        errors.push({ field: field.key, message: `${field.label || field.key} is required` });
      } else {
        output[field.key] = normalized || (field.nullable ? null : '');
      }
      continue;
    }

    if (field.type === 'dateString') {
      const normalized = normalizeString(value);
      if (Number.isNaN(Date.parse(normalized))) {
        errors.push({ field: field.key, message: `${field.label || field.key} must be a valid date` });
      } else {
        output[field.key] = normalized;
      }
      continue;
    }

    if (field.type === 'enum') {
      const normalized = normalizeString(value);
      if (!field.values.includes(normalized)) {
        errors.push({ field: field.key, message: `${field.label || field.key} must be one of: ${field.values.join(', ')}` });
      } else {
        output[field.key] = normalized;
      }
      continue;
    }

    output[field.key] = value;
  }

  if (errors.length) {
    throw validationError('Invalid request payload', errors);
  }

  return output;
};

const validateLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw validationError('Invalid request payload', [{ field: 'lines', message: 'lines must include at least one shipment line' }]);
  }

  return lines.map((line, index) => validateRequestBody(line, [
    { key: 'skuId', aliases: ['sku_id'], type: 'positiveInt', required: true, label: `lines[${index}].skuId` },
    { key: 'quantity', type: 'positiveInt', required: true, label: `lines[${index}].quantity` }
  ]));
};

module.exports = {
  parsePositiveInt,
  optionalInt,
  validateRequestBody,
  validateLines
};
