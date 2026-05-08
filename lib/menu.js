const MENUS = {
  ar: {
    languagePrompt:
      'أهلاً وسهلاً بك في *شركة اليافور للمقاولات العامة* 🏗️\n\n' +
      'الرجاء اختيار لغة التواصل:\n' +
      '1️⃣ العربية\n' +
      '2️⃣ English',

    mainMenu:
      '*القائمة الرئيسية* 📋\n\n' +
      'الرجاء اختيار القسم المناسب:\n\n' +
      '1️⃣  استفسار عن مشروع قائم\n' +
      '2️⃣  طلب عرض سعر / مناقصة\n' +
      '3️⃣  إدارة المشتريات والموردين\n' +
      '4️⃣  الحسابات والفواتير\n' +
      '5️⃣  مهندس المواقع\n' +
      '6️⃣  المبيعات\n' +
      '7️⃣  التواصل مع الإدارة (CI)\n' +
      '8️⃣  مواعيد العمل والتواصل\n' +
      '9️⃣  التحدث مع موظف',

    departments: {
      '1': 'استفسار عن مشروع قائم',
      '2': 'طلب عرض سعر / مناقصة',
      '3': 'إدارة المشتريات والموردين',
      '4': 'الحسابات والفواتير',
      '5': 'مهندس المواقع',
      '6': 'المبيعات',
      '7': 'التواصل مع الإدارة (CI)',
      '8': 'مواعيد العمل والتواصل',
      '9': 'موظف بشري',
    },

    outOfHours:
      'شكراً على تواصلك مع *اليافور للمقاولات العامة* 🏗️\n\n' +
      'مكتبنا مغلق حالياً خارج أوقات الدوام.\n\n' +
      '⏰ *أوقات العمل:*\n' +
      'السبت – الخميس: 8:00 صباحاً – 6:00 مساءً\n' +
      'الجمعة: إجازة\n\n' +
      'سنتواصل معك في أقرب وقت عمل. للأمور العاجلة:\n' +
      '📞 *+971 50 166 7613*',

    humanAgent:
      'سيتم تحويلك لأحد موظفينا فوراً 👤\n\n' +
      'للتواصل المباشر:\n' +
      '📞 *+971 50 166 7613*',

    workingHoursInfo:
      '⏰ *أوقات العمل*\n\n' +
      'السبت – الخميس: 8:00 صباحاً – 6:00 مساءً\n' +
      'الجمعة: إجازة\n\n' +
      '📞 هاتف: *+971 50 166 7613*\n' +
      '📧 بريد: info@alyafour.com\n\n' +
      '_(اكتب *قائمة* للعودة للقائمة الرئيسية)_',

    aiIntro: (dept) =>
      `أنت الآن في قسم *${dept}* ✅\n\n` +
      'يسعدني مساعدتك. ما الذي تودّ الاستفسار عنه؟\n\n' +
      '_(اكتب *قائمة* للعودة، أو *موظف* للتحدث مع أحدنا مباشرة)_',

    backToMenu: 'تم العودة للقائمة الرئيسية ✅\n\n',

    invalidOption:
      'عذراً، الخيار غير صحيح ❌\n' +
      'الرجاء اختيار رقم من القائمة أدناه:\n\n',

    outsideScope:
      'شكراً على سؤالك. هذا الموضوع يتطلب التواصل المباشر مع أحد موظفينا.\n\n' +
      '📞 *+971 50 166 7613*\n\n' +
      '_(اكتب *قائمة* للعودة للقائمة الرئيسية)_',
  },

  en: {
    languagePrompt:
      'Welcome to *Al Yafour General Contracting LLC* 🏗️\n\n' +
      'Please select your preferred language:\n' +
      '1️⃣ العربية\n' +
      '2️⃣ English',

    mainMenu:
      '*Main Menu* 📋\n\n' +
      'Please select a department:\n\n' +
      '1️⃣  Project Inquiry\n' +
      '2️⃣  Request Quotation / Tender\n' +
      '3️⃣  Procurement & Suppliers\n' +
      '4️⃣  Accounts & Invoices\n' +
      '5️⃣  Site Engineer\n' +
      '6️⃣  Sales\n' +
      '7️⃣  Management (CI)\n' +
      '8️⃣  Working Hours & Contact\n' +
      '9️⃣  Speak with an Agent',

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
      'Thank you for contacting *Al Yafour General Contracting LLC* 🏗️\n\n' +
      'Our office is currently closed.\n\n' +
      '⏰ *Working Hours:*\n' +
      'Saturday – Thursday: 8:00 AM – 6:00 PM\n' +
      'Friday: Off\n\n' +
      'We will get back to you on the next working day. For urgent matters:\n' +
      '📞 *+971 50 166 7613*',

    humanAgent:
      'You will be connected to one of our staff members shortly 👤\n\n' +
      'For direct contact:\n' +
      '📞 *+971 50 166 7613*',

    workingHoursInfo:
      '⏰ *Working Hours*\n\n' +
      'Saturday – Thursday: 8:00 AM – 6:00 PM\n' +
      'Friday: Off\n\n' +
      '📞 Phone: *+971 50 166 7613*\n' +
      '📧 Email: info@alyafour.com\n\n' +
      '_(Type *menu* to return to the main menu)_',

    aiIntro: (dept) =>
      `You are now in the *${dept}* department ✅\n\n` +
      "I'm here to help. What would you like to know?\n\n" +
      '_(Type *menu* to go back, or *agent* to speak with a staff member directly)_',

    backToMenu: 'Returned to main menu ✅\n\n',

    invalidOption:
      'Sorry, invalid option ❌\n' +
      'Please choose a number from the menu below:\n\n',

    outsideScope:
      "Thank you for your question. This topic requires direct assistance from one of our staff members.\n\n" +
      '📞 *+971 50 166 7613*\n\n' +
      '_(Type *menu* to return to the main menu)_',
  },
};

module.exports = MENUS;
