import { describe, it, expect } from 'vitest';
import { clienteChave, periodo, lerSemanal } from '../../src/app/diretoria.js';
import { diferenca, fotografar } from '../../src/app/sync.js';

describe('Diretoria: regras', () => {
  it('Animale junta Animale e Seda pelo nome; Mixed e Le Lis ficam separados', () => {
    expect(['Animale SP', 'SEDA', 'seda brasil', 'MIXED', 'Le Lis Blanc', '', null].map(clienteChave))
      .toEqual(['ANIMALE', 'ANIMALE', 'ANIMALE', 'MIXED', 'LE LIS BLANC', '(SEM CLIENTE)', '(SEM CLIENTE)']);
  });
  it('sem filtro só entram meses fechados; escolhendo, entra até o mês corrente', () => {
    expect(periodo(2026, [], [], '2026-03')).toEqual({ ms: ['2026-01', '2026-02'], prev: ['2025-01', '2025-02'] });
    expect(periodo(2026, [], ['3', '4'], '2026-03').ms).toEqual(['2026-03']);
    expect(periodo(2026, ['2'], [], '2026-11').ms).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(periodo(2025, [], [], '2026-11').ms.length).toBe(12);
  });
});

describe('Diretoria: leitura da aba SEMANAL', () => {
  const L = (os, cli, obs, qtd, valor, data) => ['', '', os, cli, 'CANAL', 'PROD', 10, 5, obs, qtd, valor, data, 'NF1'];
  it('segue as regras de limpeza do Power BI', () => {
    const r = lerSemanal([
      L('OS', 'CLIENTE', 'OBS', 'QTD', 'VALOR', 'DATA'),
      L('101', 'ANIMALE', '', 10, 'R$ 1.234,50', '05/10/2026'),
      L('102', 'MIXED', '', 5, 100, new Date(Date.UTC(2026, 9, 7))),
      L('PREVISÃO', 'X', '', 3, 30, '01/10/2026'),
      L('103', 'X', 'TOTAL OUTUBRO', 99, 999, '01/10/2026'),
      L('104', 'Y', '', 2, 20, ''),
      null,
    ]);
    expect(r.rows.map((x) => [x.data, x.os, x.cli, x.qtd, x.valor])).toEqual([['2026-10-05', '101', 'ANIMALE', 10, 1234.5], ['2026-10-07', '102', 'MIXED', 5, 100]]);
    expect([r.ign, r.semData]).toEqual([2, 1]);
  });
});

describe('Diretoria: metas vão para a Config', () => {
  it('manda metas só quando mudam', () => {
    const S = { contas: [], prazoOf: 15, prevReview: {}, dirMetas: null, dirMetaFat: null };
    const f = fotografar(S);
    expect(diferenca(f, S).vazio).toBe(true);
    S.dirMetas = { ALUGUEL: 2.5 }; S.dirMetaFat = 2000000;
    expect(diferenca(f, S).mud.Config).toEqual({ dirMetas: { ALUGUEL: 2.5 }, dirMetaFat: 2000000 });
  });
});
