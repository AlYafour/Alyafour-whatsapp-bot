const { withAuth } = require('../../lib/authMiddleware');
const { listApprovedTemplates } = require('../../lib/templateService');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  try {
    const templates = await listApprovedTemplates({ forceRefresh });
    // wabaId is surfaced so the dashboard can show WHICH WhatsApp Business
    // Account the list comes from — the #1 cause of "my template is
    // approved but missing" is creating it under a different WABA.
    return res.status(200).json({ templates, wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null });
  } catch (err) {
    console.error('[admin/templates] error:', err.message);
    return res.status(502).json({
      error: 'META_FETCH_FAILED',
      message: 'تعذر جلب القوالب المعتمدة من Meta. تحقق من WHATSAPP_BUSINESS_ACCOUNT_ID وصلاحية التوكن.',
    });
  }
});
