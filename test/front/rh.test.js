import { describe, it, expect } from 'vitest';
import { lerColaboradores, mesclarColaboradores, rhSitDeObs } from '../../src/app/rh.js';

// Planilha fictícia no formato da "Geral colaboradores" (repositório público: nenhum dado real).
const CAB = ['QUANT.', 'LOCAL', 'NOME', 'ADMISSÃO', 'FUNÇÃO', 'SETOR', 'LIDER', 'SALÁRIO', 'PRÊMIO FIXO', 'POR FORA', 'OBS', 'Produção/Adm', 'CLT ou PJ', 'TEM 13º/FÉRIAS?'];
const linhas = () => [CAB,
  [1, 'SPO', 'Diretor Teste', null, 'DIRETOR(A)', 'DIRETORIA', null, null, null, null, null, 'ADM', 'CLT', null],
  [2, 'MTZ', 'Gerente Fictício', new Date(Date.UTC(2020, 0, 15)), 'GERENTE', 'PCP', 'DIRETOR TESTE', 1000, null, null, null, 'PRODUÇÃO', 'PJ', 'SIM'],
  [3, 'MTZ', 'Costureira  Um', '03/02/2024', 'COSTUREIRO (A)', 'COSTURA', 'Gerente Fictício', 'R$ 500,50', 50, null, 'Está cumprindo aviso prévio até 10/12/2026.', 'PRODUÇÃO', 'CLT', null],
  [4, 'TOLEDO', 'Assistente Dois', null, 'AUXILIAR', 'FATURAMENTO', 'Gerente Ficticio', 300, null, null, 'AFASTADA', 'ADM', 'PJ', 'APENAS 13º'],
  [5, 'SPO', 'Ajudante Três', null, 'AJUDANTE', 'CORTE', 'NINGUÉM', 200, null, null, null, 'PRODUÇÃO', 'PJ', null],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null]];

describe('RH: leitura da planilha Geral colaboradores', () => {
  it('lê unidade, vínculo, área, 13º/férias de PJ, situação pela OBS e valores em texto', () => {
    const { pessoas, avisos } = lerColaboradores(linhas());
    expect(pessoas).toHaveLength(5);
    const [d, g, c, a, t] = pessoas;
    expect(d).toMatchObject({ nome: 'DIRETOR TESTE', loc: 'SP', vinc: 'clt', pa: 'adm', sal: null, lidNome: '' });
    expect(g).toMatchObject({ loc: 'BP', adm: '2020-01-15', vinc: 'pj', prov: { d13: true, fer: true, ter: true, multa: false }, sal: 1000, pa: 'prod' });
    expect(c).toMatchObject({ nome: 'COSTUREIRA UM', adm: '2024-02-03', sal: 500.5, pr: 50, sit: 'aviso', ate: '2026-12-10', prov: null });
    expect(a).toMatchObject({ loc: 'TOL', sit: 'afastado', prov: { d13: true, fer: false }, lidNome: 'GERENTE FICTICIO' });
    expect(t.prov).toEqual({ d13: false, fer: false, ter: false, multa: false });
    expect(avisos.some((x) => /AJUDANTE TRÊS: PJ sem resposta/.test(x))).toBe(true);
    expect(avisos.some((x) => /líder "NINGUEM" não está na lista/.test(x))).toBe(true);
  });
  it('sem as colunas obrigatórias, explica o que falta', () => {
    expect(() => lerColaboradores([['NOME', 'LIDER'], ['A', 'B']])).toThrow(/LOCAL, SETOR, SALARIO, CLT OU PJ/);
  });
  it('situação pela observação', () => {
    expect(rhSitDeObs('Férias até 16/12')).toMatchObject({ sit: 'ferias' });
    expect(rhSitDeObs('')).toEqual({ sit: 'ativo', ate: '' });
  });
});

describe('RH: juntar a planilha com o cadastro', () => {
  it('liga o líder pelo nome (sem acento), mantém id e apelido, registra mudança e quem saiu', () => {
    const { pessoas } = lerColaboradores(linhas());
    const m1 = mesclarColaboradores([], pessoas, '2026-11-26T10:00', 'Teste');
    expect(m1.novos).toHaveLength(5);
    const ger = m1.ppl.find((p) => p.nome === 'GERENTE FICTÍCIO');
    expect(m1.ppl.find((p) => p.nome === 'ASSISTENTE DOIS').lid).toBe(ger.id);
    expect(ger.lid).toBe(m1.ppl.find((p) => p.nome === 'DIRETOR TESTE').id);
    const atuais = m1.ppl.map((p) => (p.nome === 'COSTUREIRA UM' ? { ...p, apel: 'Cida' } : p)).concat([{ id: 'c099', nome: 'SAIU', log: [] }]);
    const l2 = lerColaboradores(linhas()).pessoas; l2[2].sal = 600;
    const m2 = mesclarColaboradores(atuais, l2, '2026-11-27T10:00', 'Teste');
    expect(m2.novos).toHaveLength(0);
    expect(m2.mudados.map((p) => p.nome)).toEqual(['COSTUREIRA UM']);
    expect(m2.saem.map((p) => p.nome)).toEqual(['SAIU']);
    const cos = m2.ppl.find((p) => p.nome === 'COSTUREIRA UM');
    expect(cos).toMatchObject({ apel: 'Cida', sal: 600, id: atuais.find((p) => p.nome === 'COSTUREIRA UM').id });
    expect(cos.log.map((x) => x.txt)).toEqual([expect.stringMatching(/^Veio da planilha/), 'Atualizado pela planilha Geral colaboradores']);
    expect(m2.ppl.find((p) => p.nome === 'GERENTE FICTÍCIO').log).toHaveLength(1);
  });
});
