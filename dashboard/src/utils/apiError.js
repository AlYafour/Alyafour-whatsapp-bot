// Maps a backend error code (err.code, e.g. "INVALID_PHONE") to a localized
// string via i18next's errors.* namespace. Falls back to the server's own
// message (already human-readable Arabic/English) for unmapped codes, and
// finally to a generic localized message.
export function translateApiError(err, t) {
  if (!err) return t('errors.generic');
  if (err.code && t(`errors.${err.code}`, { defaultValue: '' })) {
    return t(`errors.${err.code}`);
  }
  return err.message || t('errors.generic');
}
