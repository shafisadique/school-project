// utils/image.js
exports.toR2Key = (value) => {
  if (!value) return '';
  // If it's a full R2 URL, extract the key after /school-bucket/
  if (/^https?:\/\/.*\/school-bucket\//i.test(value)) {
    const marker = '/school-bucket/';
    const idx = value.indexOf(marker);
    if (idx !== -1) {
      return value.substring(idx + marker.length);
    }
    return '';
  }
  // If it's already a key (e.g., from file upload), use as-is
  return value.replace(/^\/+/, '');
};