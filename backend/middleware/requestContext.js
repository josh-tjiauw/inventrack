const crypto = require('crypto');

const createRequestId = () => {
  if (crypto.randomUUID) return `req_${crypto.randomUUID()}`;
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
};

const requestContext = (req, res, next) => {
  const inboundRequestId = req.get('X-Request-Id');
  req.requestId = inboundRequestId && inboundRequestId.trim() ? inboundRequestId.trim() : createRequestId();
  res.setHeader('X-Request-Id', req.requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs
    }));
  });

  next();
};

module.exports = { requestContext };
