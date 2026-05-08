const MENUS = {
  ar: {
    languagePrompt:
      '🏗️ *اليافور للنقليات والمقاولات العامة*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      'أهلاً بك في خدمة العملاء\n\n' +
      'يُرجى اختيار لغة التواصل:\n\n' +
      '1️⃣  العربية\n' +
      '2️⃣  English',

    mainMenu:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '📋 *القائمة الرئيسية*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '1️⃣  استفسار عن مشروع قائم\n' +
      '2️⃣  طلب عرض سعر / مناقصة\n' +
      '3️⃣  إدارة المشتريات والموردين\n' +
      '4️⃣  الحسابات والفواتير\n' +
      '5️⃣  مهندس المواقع\n' +
      '6️⃣  المبيعات\n' +
      '7️⃣  التواصل مع الإدارة\n' +
      '8️⃣  مواعيد العمل والتواصل\n' +
      '9️⃣  التحدث مع موظف\n\n' +
      '_أرسل رقم الخيار للمتابعة_',

    departments: {
      '1': 'استفسار عن مشروع قائم',
      '2': 'طلب عرض سعر / مناقصة',
      '3': 'إدارة المشتريات والموردين',
      '4': 'الحسابات والفواتير',
      '5': 'مهندس المواقع',
      '6': 'المبيعات',
      '7': 'التواصل مع الإدارة',
      '8': 'مواعيد العمل والتواصل',
      '9': 'موظف بشري',
    },

    outOfHours:
      '🏗️ *اليافور للنقليات والمقاولات العامة*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'شكراً على تواصلك معنا.\n\n' +
      '🔴 المكتب مغلق حالياً\n\n' +
      '⏰ *أوقات الدوام الرسمي:*\n' +
      'السبت – الخميس\n' +
      '8:00 صباحاً – 6:00 مساءً\n\n' +
      'سيتم الرد على استفسارك في أول وقت عمل.\n\n' +
      '📞 للطوارئ: *+971 50 166 7613*',

    humanAgent:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '👤 *تحويل لموظف متخصص*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'سيتواصل معك أحد موظفينا قريباً.\n\n' +
      '📞 *+971 50 166 7613*\n\n' +
      '_يمكنك الاتصال مباشرة أو إرسال رسالة واتساب_',

    workingHoursInfo:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '⏰ *مواعيد العمل والتواصل*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🗓️ *أيام العمل:*\n' +
      'السبت – الخميس\n\n' +
      '🕗 *ساعات الدوام:*\n' +
      '8:00 صباحاً – 6:00 مساءً\n\n' +
      '🔴 الجمعة: إجازة رسمية\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '📞 *هاتف:* +971 50 166 7613\n' +
      '📞 *مكتب:* +971 2 443 3571\n' +
      '📧 *بريد:* info@alyafour.com\n' +
      '🌐 *موقع:* www.alyafour.com\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '_اكتب *قائمة* للعودة_',

    aiIntro: (dept) =>
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ *${dept}*\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'مرحباً! يسعدني مساعدتك.\n\n' +
      'يمكنني الإجابة على استفساراتك أو تحويلك للمختص مباشرة.\n\n' +
      '_اكتب *قائمة* للعودة | *موظف* للتحدث مع أحدنا_',

    backToMenu: '✅ تم العودة للقائمة الرئيسية\n\n',
    invalidOption: '❌ خيار غير صحيح، يُرجى إرسال رقم من القائمة:\n\n',

    outsideScope:
      'شكراً على تواصلك.\n\n' +
      'هذا الموضوع يتطلب التنسيق المباشر مع فريقنا المتخصص.\n\n' +
      '📞 *+971 50 166 7613*\n\n' +
      '_اكتب *قائمة* للعودة_',
  },

  en: {
    languagePrompt:
      '🏗️ *Al Yafour General Contracting LLC*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      'Welcome to Customer Service\n\n' +
      'Please select your language:\n\n' +
      '1️⃣  العربية\n' +
      '2️⃣  English',

    mainMenu:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '📋 *Main Menu*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '1️⃣  Project Inquiry\n' +
      '2️⃣  Request Quotation / Tender\n' +
      '3️⃣  Procurement & Suppliers\n' +
      '4️⃣  Accounts & Invoices\n' +
      '5️⃣  Site Engineer\n' +
      '6️⃣  Sales\n' +
      '7️⃣  Management (CI)\n' +
      '8️⃣  Working Hours & Contact\n' +
      '9️⃣  Speak with an Agent\n\n' +
      '_Send a number to continue_',

    departments: {
      '1': 'Project Inquiry',
      '2': 'Request Quotation / Tender',
      '3': 'Procurement & Suppliers',
      '4': 'Accounts & Invoices',
      '5': 'Site Engineer',
      '6': 'Sales',
      '7': 'Management (CI)',
      '8': 'Working Hours & Contact',
      '9': 'Human Agent',
    },

    outOfHours:
      '🏗️ *Al Yafour General Contracting LLC*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'Thank you for reaching out.\n\n' +
      '🔴 Our office is currently closed\n\n' +
      '⏰ *Working Hours:*\n' +
      'Saturday – Thursday\n' +
      '8:00 AM – 6:00 PM\n\n' +
      'We will respond to your inquiry on the next working day.\n\n' +
      '📞 Urgent: *+971 50 166 7613*',

    humanAgent:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '👤 *Connecting to a Specialist*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'A team member will be in touch shortly.\n\n' +
      '📞 *+971 50 166 7613*\n\n' +
      '_You may call or send a WhatsApp message directly_',

    workingHoursInfo:
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '⏰ *Working Hours & Contact*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🗓️ *Working Days:*\n' +
      'Saturday – Thursday\n\n' +
      '🕗 *Office Hours:*\n' +
      '8:00 AM – 6:00 PM\n\n' +
      '🔴 Friday: Official Holiday\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '📞 *Mobile:* +971 50 166 7613\n' +
      '📞 *Office:* +971 2 443 3571\n' +
      '📧 *Email:* info@alyafour.com\n' +
      '🌐 *Website:* www.alyafour.com\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '_Type *menu* to go back_',

    aiIntro: (dept) =>
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ *${dept}*\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'Hello! I\'m happy to assist you.\n\n' +
      'I can answer your questions or connect you directly with the right specialist.\n\n' +
      '_Type *menu* to go back | *agent* to speak with someone_',

    backToMenu: '✅ Returned to main menu\n\n',
    invalidOption: '❌ Invalid option. Please send a number from the menu:\n\n',

    outsideScope:
      'Thank you for your message.\n\n' +
      'This topic requires direct coordination with our specialist team.\n\n' +
      '📞 *+971 50 166 7613*\n\n' +
      '_Type *menu* to go back_',
  },
};

module.exports = MENUS;
