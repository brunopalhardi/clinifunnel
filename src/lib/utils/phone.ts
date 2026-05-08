export function normalizePhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  const withoutCountry =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  return `+55${withoutCountry}`;
}

/**
 * Formata telefone pra envio ao Clinicorp: somente digitos (DDD + numero),
 * sem o codigo de pais. Aceita qualquer formato de entrada (+55..., (15)...,
 * com ou sem hifen/parenteses/espaco).
 *
 * Retorna `null` se o numero for invalido (menor que 10 ou maior que 11
 * digitos apos remover o DDI 55).
 *
 * Cuidado especial: nao confunde DDD 55 (Rio Grande do Sul) com DDI 55. Se
 * o numero tem exatamente 10 ou 11 digitos, mantemos como esta — so faz
 * strip se o length indicar DDI presente (>= 12 digitos).
 */
export function phoneToClinicorp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const cleaned =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (cleaned.length < 10 || cleaned.length > 11) return null;
  return cleaned;
}

/**
 * Retorna a "chave" de matching de um telefone: DDD + últimos 8 dígitos.
 * Lida com a inconsistência do nono dígito brasileiro (alguns sistemas
 * incluem, outros não).
 *
 * Ex: +5585989296869 → "8589296869"
 * Ex: +558598446284  → "8598446284"
 * Ex: 85989296869    → "8589296869"
 */
export function phoneMatchKey(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Remove código do país (55) se tiver
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  // Precisa ter no mínimo DDD (2) + 8 dígitos
  if (withoutCountry.length < 10) return null;
  // DDD = 2 primeiros dígitos
  const ddd = withoutCountry.slice(0, 2);
  // Resto: pode ter 8 (fixo) ou 9 (celular com nono dígito)
  const rest = withoutCountry.slice(2);
  // Pega os últimos 8 dígitos do resto (descarta nono se presente)
  const last8 = rest.slice(-8);
  return ddd + last8;
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
