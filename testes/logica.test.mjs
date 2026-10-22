// Rode com: node testes/logica.test.mjs
import assert from 'node:assert/strict';
import { mesAdd, jogosDoMes, slug, chavePix, crc16, pixPayload } from '../js/logica.js';

assert.equal(mesAdd('2026-12', 1), '2027-01');
assert.equal(mesAdd('2026-01', -1), '2025-12');
assert.equal(mesAdd('2026-10', 0), '2026-10');

assert.deepEqual(jogosDoMes('2026-10'), ['2026-10-03','2026-10-06','2026-10-10','2026-10-13','2026-10-17','2026-10-20','2026-10-24','2026-10-27','2026-10-31']);
assert.equal(jogosDoMes('2026-11').length, 8);

assert.equal(slug('Thainá'), 'thaina');
assert.equal(slug('Felipe Bazani'), 'felipe-bazani');

assert.equal(chavePix('Jansey@StudioJS.com.br'), 'jansey@studiojs.com.br');
assert.equal(chavePix('(11) 92536-5778'), '+5511925365778');

// Exemplo oficial do Banco Central: CRC esperado 1D3D.
assert.equal(crc16('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'), '1D3D');

const p = pixPayload({ chave: 'jansey@studiojs.com.br', nome: 'Jansey Oliveira', cidade: 'São Paulo', valor: 85, txid: 'MENSAL202611' });
assert.ok(p.startsWith('000201'));
assert.ok(p.includes('540585.00'));
assert.ok(p.includes('6009SAO PAULO'));
assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
assert.equal(pixPayload({ chave: '', nome: 'x', cidade: 'y' }), '');

console.log('Todos os testes de lógica passaram.');
