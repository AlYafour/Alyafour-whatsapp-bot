const { withAuth } = require('../../lib/authMiddleware');
const { listApprovedTemplates } = require('../../lib/templateService');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  try {
    const templates = await listApprovedTemplates({ forceRefresh });
    return res.status(200).json({ templates });
  } catch (err) {
    console.error('[admin/templates] error:', err.message);
    return res.status(502).json({
      error: 'META_FETCH_FAILED',
      message: 'تعذر جلب القوالب المعتمدة من Meta. تحقق من WHATSAPP_BUSINESS_ACCOUNT_ID وصلاحية التوكن.',
    });
  }
});
