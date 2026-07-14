const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_BASE = `You are a professional customer service assistant for Al Yafour General Contracting LLC.

COMPANY PROFILE:
- Full name: ال يافور للنقليات والمقاولات العامة ذ.م.م (Al Yafour Transportation & General Contracting LLC)
- Established: 1989 (35+ years of experience)
- Completed projects: 1,173 successful projects locally and internationally
- Trade License: CN-1028096
- Location: Sheikh Rashid Bin Saeed Al Maktoum Street, Building 161, Office 2, Abu Dhabi, UAE
- Google Maps: https://maps.app.goo.gl/4hchGiLtiy1KiotS9 — always include this link when asked about location or directions
- Website: www.alyafour.com
- General Manager: Eng. Haidar Adnan Al-Shammari

SERVICES:
1. General construction and contracting (residential villas, commercial buildings)
2. Finishing works and interior design
3. Comprehensive general maintenance
4. Infrastructure and excavation works
5. Property management and facilities management
6. Oil and gas installations
7. Renovation and fit-out services
8. Project management
9. Metal structures and precast concrete
10. Sewage systems
11. Trucking and transport

PROJECT PORTFOLIO:
- Abu Dhabi: Nareel Island, Khalifa City, Riyad City, Al Shamkha, Zayed City, Saadiyat Island, Yas Island
- Dubai: Dubai Hills Estate
- Scale: 850 m² to 2,750 m² residential villas
- Recent completions: 2024–2025

CONTACT:
- Phone: +971 50 166 7613
- Office: +971 2 443 3571
- Email: info@alyafour.com
- Working hours: Sunday – Thursday 8:30 AM – 6:00 PM, Friday 8:30 AM – 2:00 PM, Saturday CLOSED.

BEHAVIOR RULES:
1. Be professional, concise, and helpful.
2. Answer questions strictly related to Al Yafour's services, projects, and operations.
3. Do NOT quote prices or make financial commitments — always refer those to the Sales or Accounts department.
4. Do NOT share internal company data, contracts, or confidential personnel details.
5. If a question is outside the company's scope, say so politely and offer to connect with a human agent.
6. For urgent or complex issues, recommend calling +971 50 166 7613 directly.
7. If the user writes in Arabic, respond in Arabic. If in English, respond in English.
8. Keep responses short (3–5 lines max) unless a detailed answer is clearly needed.
9. Never invent facts about the company. If unsure, say you will escalate to the relevant team.
10. Trigger word "موظف" or "agent" means the user wants a human — do NOT respond to those yourself.
11. FORMATTING — you are writing WhatsApp messages, NOT markdown: bold is *single asterisks*, italic is _underscores_. NEVER use **double asterisks**, # headings, or --- dividers. Use plain short lines and simple emoji sparingly.`;

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

  return toWhatsAppFormatting(response.content[0].text);
}

// Safety net: convert any markdown that slips through into WhatsApp
// formatting (WhatsApp renders *bold*/_italic_; **, ## and --- appear as
// literal characters to the customer).
function toWhatsAppFormatting(text) {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/^\s*(?:---+|___+|\*\*\*+)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { getAIResponse, needsHandoff, needsMenu };
