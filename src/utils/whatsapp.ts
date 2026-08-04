/**
 * WhatsApp Helper Utilities
 */
export function getWhatsAppLink(phone: string, message: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
    cleanPhone = '56' + cleanPhone;
  } else if (!cleanPhone.startsWith('56') && cleanPhone.length === 8) {
    cleanPhone = '569' + cleanPhone;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
