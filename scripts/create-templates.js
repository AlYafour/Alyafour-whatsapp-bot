/* eslint-disable no-console */
// Registers professional Arabic + English UTILITY templates on the WhatsApp
// Business Account, replacing the default "hello_world" sample for the
// dashboard's New Conversation flow. Utility templates are usually approved
// by Meta within minutes.
//
// Usage:  node scripts/create-templates.js
// Needs:  WHATSAPP_ACCESS_TOKEN + WHATSAPP_BUSINESS_ACCOUNT_ID in .env
require('dotenv').config();

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

if (!TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env');
  process.exit(1);
}

const TEMPLATES = [
  {
    name: 'alyafour_follow_up',
    language: 'ar',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text:
          'السلام عليكم {{1}}،\n\nمعك فريق شركة اليافور للنقليات والمقاولات العامة. نتواصل معك بخصوص: {{2}}.\n\nيمكنك الرد على هذه الرسالة مباشرة وسيتابع معك الموظف المختص.',
        example: { body_text: [['أستاذ محمد', 'عرض السعر المطلوب']] },
      },
      { type: 'FOOTER', text: 'اليافور للنقليات والمقاولات العامة — أبوظبي' },
    ],
  },
  {
    name: 'alyafour_follow_up',
    language: 'en',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text:
          'Dear {{1}},\n\nThis is Al Yafour General Contracting LLC. We are reaching out regarding: {{2}}.\n\nYou can reply to this message directly and the responsible team member will assist you.',
        example: { body_text: [['Mr. Mohammed', 'your requested quotation']] },
      },
      { type: 'FOOTER', text: 'Al Yafour General Contracting LLC — Abu Dhabi' },
    ],
  },
];

async function createTemplate(tpl) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(tpl),
  });
  const body = await res.json();
  if (body.error) {
    const msg = body.error.error_user_msg || body.error.message;
    if (/already exists/i.test(msg)) {
      console.log(`= ${tpl.name} (${tpl.language}) already exists — skipped`);
      return;
    }
    console.error(`✗ ${tpl.name} (${tpl.language}): ${msg}`);
    return;
  }
  console.log(`✓ ${tpl.name} (${tpl.language}) submitted — status: ${body.status || 'PENDING'}`);
}

(async () => {
  for (const tpl of TEMPLATES) await createTemplate(tpl);
  console.log('\nDone. Approval usually takes a few minutes; refresh the template list in the New Conversation dialog afterwards.');
})();
