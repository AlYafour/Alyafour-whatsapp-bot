// UAE is UTC+4 (Asia/Dubai). Working days: Sat–Thu, 8 AM–6 PM. Friday is off.
function isBusinessHours() {
  const now = new Date();
  const uae = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));

  const day = uae.getDay(); // 0=Sun … 5=Fri … 6=Sat
  const hour = uae.getHours();

  if (day === 5) return false; // Friday off
  return hour >= 8 && hour < 18;
}

function getUAETimeString() {
  return new Date().toLocaleString('ar-AE', {
    timeZone: 'Asia/Dubai',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = { isBusinessHours, getUAETimeString };
