const ROLE_HIERARCHY = {
  viewer: 0,
  operator: 1,
  manager: 2,
  admin: 3
};

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, normalized) ? normalized : null;
};

const parseOptionalCompanyId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getTokenRole = (token) => {
  const configuredTokens = [
    ['admin', process.env.DEMO_ADMIN_TOKEN],
    ['manager', process.env.DEMO_MANAGER_TOKEN],
    ['operator', process.env.DEMO_OPERATOR_TOKEN],
    ['viewer', process.env.DEMO_VIEWER_TOKEN]
  ];

  const match = configuredTokens.find(([, configuredToken]) => configuredToken && configuredToken === token);
  return match ? match[0] : null;
};

const authError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const demoAuth = (req, res, next) => {
  const strictAuth = process.env.DEMO_AUTH_REQUIRED === 'true';
  const authHeader = req.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;
  const tokenRole = bearerToken ? getTokenRole(bearerToken) : null;
  const headerRole = normalizeRole(req.get('X-Demo-Role'));

  if (strictAuth && !tokenRole) {
    return next(authError(401, 'AUTHENTICATION_REQUIRED', 'A valid demo API bearer token is required'));
  }

  req.auth = {
    role: tokenRole || headerRole || 'admin',
    companyId: parseOptionalCompanyId(req.get('X-Company-Id') || process.env.DEMO_COMPANY_ID),
    source: tokenRole ? 'bearer_token' : headerRole ? 'demo_header' : 'demo_default'
  };

  next();
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  const role = normalizeRole(req.auth?.role);
  const allowed = allowedRoles.map(normalizeRole).filter(Boolean);

  if (!role || !allowed.includes(role)) {
    return next(authError(403, 'FORBIDDEN_ROLE', `Role ${role || 'unknown'} cannot perform this operation`));
  }

  next();
};

const enforceTenantScope = (req, res, next) => {
  const scopedCompanyId = req.auth?.companyId;
  const requestedCompanyId = parseOptionalCompanyId(req.query.companyId || req.body?.companyId || req.body?.company_id);

  if (!scopedCompanyId) {
    return next();
  }

  if (requestedCompanyId && requestedCompanyId !== scopedCompanyId) {
    return next(authError(403, 'TENANT_SCOPE_VIOLATION', `Request is outside authorized company ${scopedCompanyId}`));
  }

  if (!requestedCompanyId && req.method === 'GET') {
    req.query.companyId = String(scopedCompanyId);
  }

  next();
};

module.exports = {
  demoAuth,
  enforceTenantScope,
  requireRole,
  ROLE_HIERARCHY
};
