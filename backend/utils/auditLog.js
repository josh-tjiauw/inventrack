const writeAuditLog = async (client, {
  companyId,
  actorUserId = null,
  action,
  entityType,
  entityId = null,
  before = null,
  after = null,
  requestId = null
}) => {
  if (!companyId || !action || !entityType) return null;

  const result = await client.query(`
    INSERT INTO audit_logs (
      company_id, actor_user_id, action, entity_type, entity_id,
      before_json, after_json, request_id
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
    RETURNING id AS audit_log_id, company_id, actor_user_id, action, entity_type, entity_id, request_id, created_at
  `, [
    companyId,
    actorUserId,
    action,
    entityType,
    entityId,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    requestId
  ]);

  return result.rows[0];
};

module.exports = { writeAuditLog };
