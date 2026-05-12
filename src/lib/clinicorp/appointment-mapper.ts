/**
 * [DASH-4] Mapeia StatusId/StatusColor dos appointments do Clinicorp pra
 * uma chave normalizada interna ("statusKey") usada nas queries do dashboard.
 *
 * O Clinicorp tem 7 status configuraveis no painel (mostrados no dropdown da
 * tela de appointment):
 *   - Agendado            (default, sem cor explicita)
 *   - 1-Confirmado        (#009688 teal)
 *   - 2-Em espera         (amarelo)
 *   - 3-Em atendimento    (azul)
 *   - 4-Atendido          (#66bb6a verde claro) -> "consulta realizada"
 *   - 5-Atrasado          (vermelho)
 *   - 6-Faltou            (#424242 cinza)
 *
 * Confirmacao do mapping foi feita olhando as conversas com a equipe da AD
 * e inspecionando StatusIds reais via API em mai/2026. Os 3 status raros
 * (Em espera, Em atendimento, Atrasado) caem em fallback por cor.
 */

export type AppointmentStatusKey =
  | "agendado"
  | "confirmado"
  | "em_espera"
  | "em_atendimento"
  | "atendido"
  | "atrasado"
  | "faltou";

// IDs canonicos confirmados em prod da clinica AD (mai/2026).
// Outras clinicas podem ter IDs diferentes — fallback usa StatusColor.
const KNOWN_STATUS_IDS: Record<string, AppointmentStatusKey> = {
  "5818903091085312": "atendido",
  "6447760961830912": "confirmado",
  "5434991667970048": "faltou",
};

// Fallback por StatusColor (hex). Funciona pra clinicas que tem o mesmo painel
// de cores mas IDs diferentes.
const COLOR_TO_KEY: Record<string, AppointmentStatusKey> = {
  "#66bb6a": "atendido",      // verde claro = 4-Atendido
  "#009688": "confirmado",    // teal = 1-Confirmado
  "#424242": "faltou",        // cinza = 6-Faltou
  "#ffeb3b": "em_espera",     // amarelo = 2-Em espera
  "#fbc02d": "em_espera",     // amarelo alt
  "#2196f3": "em_atendimento",// azul = 3-Em atendimento
  "#1976d2": "em_atendimento",// azul alt
  "#f44336": "atrasado",      // vermelho = 5-Atrasado
  "#d32f2f": "atrasado",      // vermelho alt
};

export function mapAppointmentStatus(
  statusId: string | number | null | undefined,
  statusColor: string | null | undefined,
): AppointmentStatusKey {
  if (statusId !== null && statusId !== undefined && statusId !== "") {
    const idStr = String(statusId);
    const byId = KNOWN_STATUS_IDS[idStr];
    if (byId) return byId;
  }

  if (statusColor) {
    const color = statusColor.trim().toLowerCase();
    const byColor = COLOR_TO_KEY[color];
    if (byColor) return byColor;
  }

  // Default: sem statusId ou cor reconhecida = ainda no estado inicial
  return "agendado";
}
