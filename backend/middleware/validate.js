/**
 * Input validation helpers for API endpoints.
 * No external dependencies — plain manual checks.
 */

/**
 * Create a validation middleware from a rules object.
 * 
 * @param {Object} rules - { fieldName: { required, type, message } }
 * @returns Express middleware
 * 
 * Example:
 *   validate({
 *     item: { required: true, type: 'string', message: 'Item description is required' }
 *   })
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${field} is required`);
        continue;
      }

      // Skip type checks if value is not present and not required
      if (value === undefined || value === null) continue;

      // Check type
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      } else if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
      } else if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      } else if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }

      // Check non-empty string
      if (rule.type === 'string' && typeof value === 'string' && rule.nonEmpty && value.trim() === '') {
        errors.push(rule.message || `${field} must not be empty`);
      }

      // Check non-empty array
      if (rule.type === 'array' && Array.isArray(value) && rule.nonEmpty && value.length === 0) {
        errors.push(rule.message || `${field} must not be empty`);
      }

      // Check min (for numbers)
      if (rule.type === 'number' && typeof value === 'number' && rule.min !== undefined && value < rule.min) {
        errors.push(`${field} must be at least ${rule.min}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
}

module.exports = { validate };
