const MENUS = {
  ar: {
    welcome:
      '*اليافور للنقليات والمقاولات العامة* 🏗️\n\n' +
      'أهلاً! كيف يمكنني مساعدتك اليوم؟\n\n' +
      'يمكنك سؤالي مباشرةً، أو اختيار قسم للتواصل:\n\n' +
      '1️⃣  استفسار عن مشروع قائم\n' +
      '2️⃣  طلب عرض سعر / مناقصة\n' +
      '3️⃣  إدارة المشتريات والموردين\n' +
      '4️⃣  الحسابات والفواتير\n' +
      '5️⃣  مهندس المواقع\n' +
      '6️⃣  المبيعات\n' +
      '7️⃣  التواصل مع الإدارة\n' +
      '8️⃣  مواعيد العمل والتواصل\n' +
      '9️⃣  التحدث مع موظف',

    menu:
      '*القائمة* 📋\n\n' +
      '1️⃣  استفسار عن مشروع قائم\n' +
      '2️⃣  طلب عرض سعر / مناقصة\n' +
      '3️⃣  إدارة المشتريات والموردين\n' +
      '4️⃣  الحسابات والفواتير\n' +
      '5️⃣  مهندس المواقع\n' +
      '6️⃣  المبيعات\n' +
      '7️⃣  التواصل مع الإدارة\n' +
      '8️⃣  مواعيد العمل والتواصل\n' +
      '9️⃣  التحدث مع موظف',

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
      '*اليافور للنقليات والمقاولات العامة* 🏗️\n\n' +
      'شكراً على تواصلك، مكتبنا مغلق حالياً.\n\n' +
      '🕗 *أوقات العمل*\n' +
      'الأحد – الخميس: 8:30 ص – 6:00 م\n' +
      'الجمعة: 8:30 ص – 2:00 م\n\n' +
      'سنرد عليك في أقرب وقت عمل.\n' +
      'للطوارئ: 📞 *+971 50 166 7613*',

    humanAgent:
      'سيتواصل معك أحد موظفينا قريباً. 👤\n\n' +
      '📞 *+971 50 166 7613*\n' +
      '_يمكنك الاتصال أو مراسلتنا على واتساب_',

    workingHoursInfo:
      '*مواعيد العمل والتواصل* 🕗\n\n' +
      'الأحد – الخميس: 8:30 ص – 6:00 م\n' +
      'الجمعة: 8:30 ص – 2:00 م\n' +
      'السبت: مغلق\n\n' +
      '📞 *+971 50 166 7613*\n' +
      '📞 *+971 2 443 3571*\n' +
      '📧 info@alyafour.com\n' +
      '🌐 www.alyafour.com\n\n' +
      '_اكتب *قائمة* لعرض الخيارات_',

    deptIntro: (dept) =>
      `*${dept}* ✅\n\n` +
      'تفضّل باستفسارك، يسعدني مساعدتك.\n\n' +
      '_اكتب *قائمة* للعودة أو *موظف* للتحدث مع أحدنا_',

    humanAgent_hint: '\n\n_اكتب *موظف* إذا أردت التحدث مع أحدنا مباشرة_',

    pleasantry: 'العفو، في خدمتك دائماً 🙏\nلا تتردد في مراسلتنا متى احتجت أي شيء.',
  },

  en: {
    welcome:
      '*Al Yafour General Contracting LLC* 🏗️\n\n' +
      'Hello! How can I help you today?\n\n' +
      'Feel free to ask me anything, or choose a department:\n\n' +
      '1️⃣  Project Inquiry\n' +
      '2️⃣  Request Quotation / Tender\n' +
      '3️⃣  Procurement & Suppliers\n' +
      '4️⃣  Accounts & Invoices\n' +
      '5️⃣  Site Engineer\n' +
      '6️⃣  Sales\n' +
      '7️⃣  Management (CI)\n' +
      '8️⃣  Working Hours & Contact\n' +
      '9️⃣  Speak with an Agent',

    menu:
      '*Menu* 📋\n\n' +
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
      '*Al Yafour General Contracting LLC* 🏗️\n\n' +
      'Thank you for reaching out. Our office is currently closed.\n\n' +
      '🕗 *Working Hours*\n' +
      'Sun – Thu: 8:30 AM – 6:00 PM\n' +
      'Friday: 8:30 AM – 2:00 PM\n\n' +
      'We will get back to you on the next working day.\n' +
      'Urgent: 📞 *+971 50 166 7613*',

    humanAgent:
      'A team member will be in touch shortly. 👤\n\n' +
      '📞 *+971 50 166 7613*\n' +
      '_You may call or message us on WhatsApp_',

    workingHoursInfo:
      '*Working Hours & Contact* 🕗\n\n' +
      'Sun – Thu: 8:30 AM – 6:00 PM\n' +
      'Friday: 8:30 AM – 2:00 PM\n' +
      'Saturday: Closed\n\n' +
      '📞 *+971 50 166 7613*\n' +
      '📞 *+971 2 443 3571*\n' +
      '📧 info@alyafour.com\n' +
      '🌐 www.alyafour.com\n\n' +
      '_Type *menu* to show options_',

    deptIntro: (dept) =>
      `*${dept}* ✅\n\n` +
      'Go ahead with your question, happy to help.\n\n' +
      '_Type *menu* to go back or *agent* to speak with someone_',

    humanAgent_hint: '\n\n_Type *agent* if you\'d like to speak with someone directly_',

    pleasantry: "You're most welcome! 🙏\nFeel free to message us anytime you need anything.",
  },
};

module.exports = MENUS;
