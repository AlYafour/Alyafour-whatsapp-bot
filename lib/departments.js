// ─── Department contacts ───────────────────────────────────────────────────────
// To add a direct WhatsApp number for any department, fill in the `whatsapp`
// field with the number in international format WITHOUT the + sign (e.g. 971501234567).
// Leave as null to use the general contact number.

const DEPARTMENTS = {
  '1': {
    nameAr: 'استفسار عن مشروع قائم',
    nameEn: 'Project Inquiry',
    phone: '+971 50 166 7613',   // replace with dedicated number when available
    email: 'info@alyafour.com',
    whatsapp: '971501667613',    // replace with dedicated WhatsApp number
    personAr: 'فريق إدارة المشاريع',
    personEn: 'Projects Team',
  },
  '2': {
    nameAr: 'طلب عرض سعر / مناقصة',
    nameEn: 'Request Quotation / Tender',
    phone: '+971 50 166 7613',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'فريق المبيعات والمناقصات',
    personEn: 'Sales & Tender Team',
  },
  '3': {
    nameAr: 'إدارة المشتريات والموردين',
    nameEn: 'Procurement & Suppliers',
    phone: '+971 50 166 7613',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'قسم المشتريات',
    personEn: 'Procurement Department',
  },
  '4': {
    nameAr: 'الحسابات والفواتير',
    nameEn: 'Accounts & Invoices',
    phone: '+971 50 166 7613',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'قسم الحسابات',
    personEn: 'Accounts Department',
  },
  '5': {
    nameAr: 'مهندس المواقع',
    nameEn: 'Site Engineer',
    phone: '+971 50 166 7613',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'قسم الهندسة',
    personEn: 'Engineering Department',
  },
  '6': {
    nameAr: 'المبيعات',
    nameEn: 'Sales',
    phone: '+971 50 166 7613',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'فريق المبيعات',
    personEn: 'Sales Team',
  },
  '7': {
    nameAr: 'التواصل مع الإدارة (CI)',
    nameEn: 'Management (CI)',
    phone: '+971 2 443 3571',
    email: 'info@alyafour.com',
    whatsapp: '971501667613',
    personAr: 'الإدارة العليا',
    personEn: 'Senior Management',
  },
};

// General fallback contact
const GENERAL_CONTACT = {
  phone: '+971 50 166 7613',
  officePhone: '+971 2 443 3571',
  email: 'info@alyafour.com',
  whatsapp: '971501667613',
  address: 'شارع الشيخ راشد بن سعيد آل مكتوم، مبنى 161، مكتب 2، أبوظبي',
  addressEn: 'Sheikh Rashid Bin Saeed Al Maktoum Street, Building 161, Office 2, Abu Dhabi',
};

function getDeptContact(deptKey) {
  return DEPARTMENTS[deptKey] || null;
}

function buildContactCard(dept, lang) {
  if (!dept) return null;
  const waLink = `https://wa.me/${dept.whatsapp}`;
  if (lang === 'ar') {
    return (
      `📋 *${dept.nameAr}*\n\n` +
      `👤 ${dept.personAr}\n` +
      `📞 ${dept.phone}\n` +
      `📧 ${dept.email}\n` +
      `💬 واتساب مباشر: ${waLink}`
    );
  }
  return (
    `📋 *${dept.nameEn}*\n\n` +
    `👤 ${dept.personEn}\n` +
    `📞 ${dept.phone}\n` +
    `📧 ${dept.email}\n` +
    `💬 Direct WhatsApp: ${waLink}`
  );
}

module.exports = { DEPARTMENTS, GENERAL_CONTACT, getDeptContact, buildContactCard };
