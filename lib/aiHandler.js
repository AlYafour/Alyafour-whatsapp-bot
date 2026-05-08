const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_BASE = `You are a professional customer service assistant for Al Yafour General Contracting LLC.

COMPANY PROFILE:
- Full name: Al Yafour General Contracting LLC (شركة اليافور للمقاولات العامة ذ.م.م)
- Location: Abu Dhabi, UAE
- Trade License: CN-1028096
- Services: Building construction, metal structures, oil & gas projects, sewage systems, precast concrete, trucking & transport
- Working hours: Saturday – Thursday, 8:00 AM – 6:00 PM (UAE time). Friday is off.
- Contact: +971 50 166 7613 | info@alyafour.com

BEHAVIOR RULES:
1. Be professional, concise, and helpful.
2. Answer questions strictly related to Al Yafour's services, projects, and operations.
3. Do NOT quote prices or make financial commitments — always refer those to the Sales or Accounts department.
4. Do NOT share internal company data, contracts, or personnel details.
5. If a question is outside the company's scope, say so politely and offer to connect with a human agent.
6. For urgent or complex issues, recommend calling +971 50 166 7613 directly.
7. If the user writes in Arabic, respond in Arabic. If in English, respond in English.
8. Keep responses short (3–5 lines max) unless a detailed answer is clearly needed.
9. Never invent facts about the company. If unsure, say you will escalate to the relevant team.
10. Trigger word "موظف" or "agent" means the user wants a human — do NOT respond to those yourself.`;

// Keywords that should trigger human-agent handoff (checked before calling AI)
const HANDOFF_TRIGGERS_AR = ['موظف', 'انسان', 'بشري', 'مسؤول', 'مدير'];
const HANDOFF_TRIGGERS_EN = ['agent', 'human', 'person', 'staff', 'manager', 'supervisor'];

function needsHandoff(text, lang) {
  const lower = text.toLowerCase().trim();
  const triggers = lang === 'ar' ? HANDOFF_TRIGGERS_AR : HANDOFF_TRIGGERS_EN;
  return triggers.some((t) => lower.includes(t));
}

// Keywords that should bring user back to main menu
const MENU_TRIGGERS_AR = ['قائمة', 'رجوع', 'رجع', 'ارجع', 'القائمة'];
const MENU_TRIGGERS_EN = ['menu', 'back', 'return', 'main'];

function needsMenu(text, lang) {
  const lower = text.toLowerCase().trim();
  const triggers = lang === 'ar' ? MENU_TRIGGERS_AR : MENU_TRIGGERS_EN;
  return triggers.some((t) => lower === t || lower.startsWith(t + ' '));
}

async function getAIResponse(userMessage, history, department, language) {
  const deptContext =
    language === 'ar'
      ? `القسم الحالي للعميل: ${department}`
      : `Current customer department: ${department}`;

  const systemPrompt = `${SYSTEM_BASE}\n\n${deptContext}`;

  const messages = [
    ...history.slice(-16), // keep last 8 exchanges (16 messages)
    { role: 'user', content: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text;
}

module.exports = { getAIResponse, needsHandoff, needsMenu };
