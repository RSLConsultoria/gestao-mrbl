import { describe, it, expect } from 'vitest';
import { clienteChave, periodo, lerSemanal, fatComDre, lerFatDre } from '../../src/app/diretoria.js';
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
  it('o mês é o bloco da planilha (linha com o nome do mês), mesmo com Data Fat. vazia, em texto ou de outro ano', () => {
    const r = lerSemanal([
      L('201', 'ANIMALE', '', 10, 100, '05/02/2025'),
      L('202', 'ANIMALE', '', 5, 50, '05/02/2024'),
      L('203', 'MIXED', '', 2, 20, '04 e 05/02/2025'),
      L('204', 'MIXED', '', 1, 10, ''),
      ['', '', '', '', '', 'L', 18, '', 0, 18, 180, '', ''],
      ['', '', '', '', '', '', '', '', 'FEVEREIRO', 18, 180, '', ''],
      ['', '', '', '', '', '', '', '', 'BRAG. PTA', 18, 180, '', ''],
    ], '2025');
    expect(r.rows.map((x) => [x.os, x.data, x.valor])).toEqual([['201', '2025-02-05', 100], ['202', '2025-02-01', 50], ['203', '2025-02-01', 20], ['204', '2025-02-01', 10]]);
    expect(r.noBloco).toBe(3);
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

describe('acessos vão para a Config', () => {
  it('manda acessos só quando mudam', () => {
    const S = { contas: [], prazoOf: 15, prevReview: {}, acesso: { perfis: [], usuarios: {} } };
    const f = fotografar(S);
    expect(diferenca(f, S).vazio).toBe(true);
    S.acesso.usuarios.Lucca = { perfil: 'adm', mods: null };
    expect(diferenca(f, S).mud.Config.acesso.usuarios.Lucca.perfil).toBe('adm');
  });
});

describe('Diretoria: faturamento em R$ vem da DRE, peças da planilha', () => {
  it('mês com DRE usa o valor da DRE e mantém as peças; mês sem DRE fica com a planilha', () => {
    const M = { '2025-02': { valor: 100000, qtd: 3000 }, '2025-03': { valor: 90000, qtd: 3100 } };
    const o = fatComDre(M, { '2025-02': 120000, '2025-04': 130500.5, '2025-05': 0 });
    expect(o['2025-02']).toEqual({ valor: 120000, qtd: 3000, plan: 100000, dre: true });
    expect(o['2025-03']).toEqual({ valor: 90000, qtd: 3100, plan: 90000 });
    expect(o['2025-04'].valor).toBe(130500.5);
    expect(o['2025-04'].qtd).toBe(0);
    expect(o['2025-05']).toBeUndefined();
    expect(M['2025-02'].valor).toBe(100000);
  });
  it('o faturamento digitado da DRE vai para a Config', () => {
    const S = { dirFatDre: null };
    const f = fotografar(S); S.dirFatDre = { '2026-02': 111111 };
    expect(diferenca(f, S).mud.Config).toEqual({ dirFatDre: { '2026-02': 111111 } });
  });
});

describe('Diretoria: linha FATURAMENTO da aba DRE', () => {
  it('lê os meses com valor da linha FATURAMENTO abaixo dos meses (colunas intercaladas, como na DRE)', () => {
    const M = ['JANEIRO ', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const cab = ['REGIME DE CAIXA']; M.forEach((m) => cab.push(m, 2030));
    const fat = ['FATURAMENTO 2030']; M.forEach((_, i) => fat.push(i < 2 ? 1000 + i : i === 2 ? 'R$ 2.500,50' : 0, '\u00a0'));
    const r = lerFatDre([['DRE GERENCIAL 2030'], ['FATURAMENTO 2030', null, null, 0], cab, ['SALDO INICIAL', 5, null, 6], fat], '2030');
    expect(r).toEqual({ ano: '2030', meses: { '2030-01': 1000, '2030-02': 1001, '2030-03': 2500.5 } });
  });
  it('avisa quando não acha os meses', () => {
    expect(() => lerFatDre([['FATURAMENTO', 1, 2]], '2030')).toThrow(/meses/);
  });
});
