/**
 * Ses veya metin sorgusundan hat numarasını çıkarır
 * Örnek: "54 ne zaman gelecek?" → "54"
 * Örnek: "12A geldi mi?" → "12A"
 */
export function extractLineNumber(text: string): string | null {
  // Regex: 1-3 rakam + opsiyonel harf (A-Z)
  const match = text.match(/\b(\d{1,3}[A-Za-z]?)\b/);
  return match ? match[1] : null;
}

/**
 * Query'nin geçerli olup olmadığını kontrol et
 */
export function isValidQuery(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const line = extractLineNumber(text);
  return line !== null;
}
