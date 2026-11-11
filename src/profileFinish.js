// Proje geneli profil rengi (kullanıcı kararı 2026-11-11): stand kaydında `profileFinish`.
// `default` katalogdaki profil rengidir (Item.defaultColor, alüminyum); `black` bütün profil,
// dikme ve modül çerçevelerini siyah çizer. Ayar standla birlikte kaydedilir, dışa / içe
// aktarılır ve geri alınır. Yalnız görünüm: BOM ve Item değişmez.

export const PROFILE_FINISH_DEFAULT = 'default';

export const PROFILE_FINISHES = Object.freeze({
  default: Object.freeze({ label: 'Varsayılan (alüminyum)', colorCss: null }),
  black: Object.freeze({ label: 'Siyah', colorCss: '#1c1c1e' }),
});

export function isKnownProfileFinish(value) {
  return typeof value === 'string' && Object.hasOwn(PROFILE_FINISHES, value);
}

/** Kayıttaki değer: bilinmeyen ya da eksikse varsayılan (eski projeler). */
export function normalizeProfileFinish(value) {
  return isKnownProfileFinish(value) ? value : PROFILE_FINISH_DEFAULT;
}

/** Çerçeve rengi: varsayılanda null (katalog rengi kullanılır), diğerlerinde css hex. */
export function profileFinishColorCss(value) {
  return PROFILE_FINISHES[normalizeProfileFinish(value)].colorCss;
}
