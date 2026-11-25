import { describe, it, expect } from 'vitest';
import { carregarServidor, chamar } from './carregar.js';

function logado() {
  const g = carregarServidor();
  for (const [n, c] of [['Lucca', 'L1'], ['Viviane', 'V1']]) g.Db.inserir('Usuarios', { nome: n, convite: c, ativo: true });
  const luc = chamar(g, 'auth.criarSenha', { nome: 'Lucca', convite: 'L1', senha: 'senha123' }).dados.token;
  const viv = chamar(g, 'auth.criarSenha', { nome: 'Viviane', convite: 'V1', senha: 'senha123' }).dados.token;
  return { g, luc, viv };
}
const linha = (data, os, valor) => ({ data, os, cli: 'CLIENTE', canal: 'X', prod: 'P', corte: 1, vUnit: 1, qtd: 1, valor, nf: '1' });

describe('base de faturamento da Diretoria', () => {
  it('só o administrador importa; mês importado substitui só aquele mês', () => {
    const { g, luc, viv } = logado();
    expect(chamar(g, 'faturamento.importar', { arquivo: 'a.xlsx', linhas: [linha('2026-01-05', '1', 10)] }, viv).ok).toBe(false);
    expect(chamar(g, 'faturamento.importar', { arquivo: 'a.xlsx', linhas: [linha('2026-01-05', '1', 10), linha('2026-02-05', '2', 20)] }, luc).ok).toBe(true);
    const r = chamar(g, 'faturamento.importar', { arquivo: 'b.xlsx', linhas: [linha('2026-02-09', '3', 30.555)] }, luc);
    expect(r.dados).toEqual({ linhas: 1, meses: ['2026-02'] });
    const d = chamar(g, 'dados.carregar', {}, luc).dados;
    expect(d.fatHistorico.map((x) => [x.data, x.os, x.valor])).toEqual([['2026-01-05', '1', 10], ['2026-02-09', '3', 30.56]]);
    expect(d.config.dirFatImp.map((x) => [x.arquivo, x.por, x.meses])).toEqual([['a.xlsx', 'Lucca', ['2026-01', '2026-02']], ['b.xlsx', 'Lucca', ['2026-02']]]);
  });
  it('recusa arquivo vazio ou linha sem data', () => {
    const { g, luc } = logado();
    expect(chamar(g, 'faturamento.importar', { linhas: [] }, luc).ok).toBe(false);
    expect(chamar(g, 'faturamento.importar', { linhas: [linha('05/01/2026', '1', 1)] }, luc).ok).toBe(false);
  });
  it('metas da Diretoria podem ser gravadas pelo app', () => {
    const { g, viv } = logado();
    const r = chamar(g, 'sync.aplicar', { tela: 'cfg', msg: 'Metas', mud: { Config: { dirMetas: { ALUGUEL: 3 }, dirMetaFat: 1900000 } } }, viv);
    expect(r.ok).toBe(true);
    expect(chamar(g, 'dados.carregar', {}, viv).dados.config).toMatchObject({ dirMetas: { ALUGUEL: 3 }, dirMetaFat: 1900000 });
  });
});
