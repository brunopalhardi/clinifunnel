export function normalizePhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  const withoutCountry =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  return `+55${withoutCountry}`;
}

export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const clean =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}
