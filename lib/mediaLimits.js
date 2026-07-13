// Official WhatsApp Cloud API media limits (verified against
// developers.facebook.com/docs/whatsapp/cloud-api/reference/media at
// implementation time). Centralized here so nothing hardcodes stale values
// in more than one place.
const LIMITS = {
  image: { mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024 },
  video: { mimeTypes: ['video/mp4', 'video/3gpp'], maxBytes: 16 * 1024 * 1024 },
  audio: {
    mimeTypes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
    maxBytes: 16 * 1024 * 1024,
  },
  voice: {
    mimeTypes: ['audio/ogg', 'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr'],
    maxBytes: 16 * 1024 * 1024,
  },
  document: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    maxBytes: 100 * 1024 * 1024,
  },
  sticker: { mimeTypes: ['image/webp'], maxBytes: 500 * 1024 },
};

function getLimits(messageType) {
  return LIMITS[messageType] || null;
}

function isAllowedMime(messageType, mimeType) {
  const limits = getLimits(messageType);
  if (!limits) return false;
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return limits.mimeTypes.includes(base);
}

function isWithinSizeLimit(messageType, fileSize) {
  const limits = getLimits(messageType);
  if (!limits) return false;
  return Number(fileSize) > 0 && Number(fileSize) <= limits.maxBytes;
}

// Lightweight magic-byte sniff so we don't trust a filename/declared
// mime_type alone — checks the first bytes actually match a known format.
function sniffMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const b = buffer;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.slice(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.slice(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (b.slice(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) {
    return 'application/zip'; // office formats (docx/xlsx/pptx) are zip containers
  }
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg'; // MP3 frame sync
  return null;
}

module.exports = { getLimits, isAllowedMime, isWithinSizeLimit, sniffMimeType };
