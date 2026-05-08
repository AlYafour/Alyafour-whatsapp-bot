// UAE is UTC+4 (Asia/Dubai).
// Sun–Thu: 8:30 AM – 6:00 PM
// Friday:  8:30 AM – 2:00 PM
// Saturday: Closed
function isBusinessHours() {
  const now = new Date();
  const uae = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));

  const day  = uae.getDay();    // 0=Sun … 5=Fri … 6=Sat
  const hour = uae.getHours();
  const min  = uae.getMinutes();
  const time = hour + min / 60; // decimal time e.g. 8.5 = 8:30

  if (day === 6) return false;                        // Saturday closed
  if (day === 5) return time >= 8.5 && time < 14;    // Friday 8:30–14:00
  return time >= 8.5 && time < 18;                   // Sun–Thu 8:30–18:00
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
