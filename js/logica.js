// Regras puras do mensal (sem tela e sem Firebase), testadas em testes/logica.test.mjs.

/** Completa com zero à esquerda: 3 → "03". */
export const pad = n => String(n).padStart(2, '0');

/** Soma meses a um mês "AAAA-MM": mesAdd('2026-12', 1) → '2027-01'. */
export function mesAdd(m, n) {
  let [y, mm] = m.split('-').map(Number);
  mm += n;
  while (mm > 12) { mm -= 12; y++; }
  while (mm < 1) { mm += 12; y--; }
  return `${y}-${pad(mm)}`;
}

/** Dias de jogo do mês (terças e sábados), em "AAAA-MM-DD". */
export function jogosDoMes(m) {
  const [y, mm] = m.split('-').map(Number);
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(y, mm - 1, d, 12);
    if (dt.getMonth() !== mm - 1) break;
    if (dt.getDay() === 2 || dt.getDay() === 6) out.push(`${m}-${pad(d)}`);
  }
  return out;
}

/** Identificador a partir do nome: "Thainá Silva" → "thaina-silva". */
export function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'p';
}

/* ---------- Pix: BR Code estático ("copia e cola") ---------- */
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase().trim();

/** Normaliza a chave Pix: e-mail, chave aleatória, CNPJ, CPF ou telefone (+55). */
export function chavePix(k) {
  k = String(k || '').trim(); if (!k) return '';
  if (k.includes('@')) return k.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  const d = k.replace(/\D/g, '');
  if (k.startsWith('+')) return '+' + d;
  if (d.length === 14) return d;
  if (d.length === 11 && !/[()\s-]/.test(k)) return d;
  if (d.length === 10 || d.length === 11) return '+55' + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return '+' + d;
  return k;
}

/** CRC16-CCITT usado no fim do BR Code. */
export function crc16(s) {
  let c = 0xFFFF;
  for (const ch of new TextEncoder().encode(s)) {
    c ^= ch << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
const tlv = (id, v) => id + String(new TextEncoder().encode(v).length).padStart(2, '0') + v;

/** Monta o "Pix copia e cola" com valor opcional. */
export function pixPayload({ chave, nome, cidade, valor = 0, txid = '***' }) {
  const k = chavePix(chave); if (!k) return '';
  let p = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', k)) + tlv('52', '0000') + tlv('53', '986');
  if (+valor > 0) p += tlv('54', (+valor).toFixed(2));
  p += tlv('58', 'BR') + tlv('59', semAcento(nome).slice(0, 25) || 'RECEBEDOR') + tlv('60', semAcento(cidade).slice(0, 15) || 'BRASIL');
  p += tlv('62', tlv('05', (String(txid).replace(/[^A-Za-z0-9*]/g, '') || '***').slice(0, 25))) + '6304';
  return p + crc16(p);
}

/**
 * Sorteia duplas entre os participantes (embaralhamento de Fisher-Yates).
 * Retorna { duplas: [{a, b}], sobra: id ou null }. Com número ímpar, um fica de fora.
 * As duplas são objetos porque o Firestore não guarda listas dentro de listas.
 */
export function sortearDuplas(ids, rnd = Math.random) {
  const v = [...new Set(ids)];
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  const duplas = [];
  for (let i = 0; i + 1 < v.length; i += 2) duplas.push({ a: v[i], b: v[i + 1] });
  return { duplas, sobra: v.length % 2 ? v[v.length - 1] : null };
}

/**
 * Fila da quadra (regra "quem ganha fica"): começa na ordem do sorteio (0, 1, 2…);
 * em cada partida jogam fila[0] × fila[1], a vencedora fica e a perdedora vai para o fim.
 * partidas = [{ a, b, v }] (índices das duplas; v = vencedora). Retorna a fila atual.
 */
export function filaAtual(nDuplas, partidas = []) {
  let fila = Array.from({ length: nDuplas }, (_, i) => i);
  for (const p of partidas) {
    if (fila.length < 2) break;
    const perd = p.v === fila[0] ? fila[1] : fila[0];
    fila = [p.v, ...fila.slice(2), perd];
  }
  return fila;
}

/** Vitórias seguidas da dupla que está em quadra (fila[0]) no fim das partidas. */
export function sequencia(partidas = []) {
  if (!partidas.length) return 0;
  const v = partidas[partidas.length - 1].v;
  let n = 0;
  for (let i = partidas.length - 1; i >= 0 && partidas[i].v === v; i--) n++;
  return n;
}
