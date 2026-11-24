import { describe, it, expect } from 'vitest';
import { carregarServidor, chamar } from './carregar.js';
import { lerFluxoConsolidado, numBR } from '../../src/app/historico.js';

function logado() {
  const g = carregarServidor();
  for (const [n, c] of [['Lucca', 'L1'], ['Viviane', 'V1']]) g.Db.inserir('Usuarios', { nome: n, convite: c, ativo: true });
  const luc = chamar(g, 'auth.criarSenha', { nome: 'Lucca', convite: 'L1', senha: 'senha123' }).dados.token;
  const viv = chamar(g, 'auth.criarSenha', { nome: 'Viviane', convite: 'V1', senha: 'senha123' }).dados.token;
  return { g, luc, viv };
}

describe('histórico de ano fechado (Fluxo de Caixa comparativo)', () => {
  it('só o administrador importa, e troca só as linhas daquele ano', () => {
    const { g, luc, viv } = logado();
    g.Db.substituir('DreHistorico', [{ mes: '2026-01', tipo: 'rec', cat: 'RECEBIMENTO DE CLIENTE', sub: '', valor: 10 }, { mes: '2025-01', tipo: 'rec', cat: 'VELHO', sub: '', valor: 1 }]);
    const linhas = [{ mes: '2025-01', tipo: 'rec', cat: 'TOTAL DE RECEBIMENTOS', sub: '', valor: 100.555 }, { mes: '2025-02', tipo: 'opex', cat: 'ALUGUEL', sub: 'ALUGUEL', valor: 30 }];
    expect(chamar(g, 'historico.importar', { ano: '2025', linhas }, viv).ok).toBe(false);
    const r = chamar(g, 'historico.importar', { ano: '2025', linhas }, luc);
    expect(r.ok).toBe(true);
    const h = chamar(g, 'dados.carregar', {}, luc).dados.dreHistorico;
    expect(h.map((x) => [x.mes, x.cat, x.valor])).toEqual([['2026-01', 'RECEBIMENTO DE CLIENTE', 10], ['2025-01', 'TOTAL DE RECEBIMENTOS', 100.56], ['2025-02', 'ALUGUEL', 30]]);
  });
  it('recusa linha de outro ano ou de tipo desconhecido', () => {
    const { g, luc } = logado();
    expect(chamar(g, 'historico.importar', { ano: '2025', linhas: [{ mes: '2026-01', tipo: 'rec', valor: 1 }] }, luc).ok).toBe(false);
    expect(chamar(g, 'historico.importar', { ano: '2025', linhas: [{ mes: '2025-01', tipo: 'x', valor: 1 }] }, luc).ok).toBe(false);
  });
});

describe('leitura da aba consolidada', () => {
  const M = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const L = (rot, ...v) => [rot, ...Array.from({ length: 12 }, (_, i) => v[i] ?? null)];
  const listas = { 'DESPESAS ADMINISTRATIVA': ['CORREIO', 'CONTABILIDADE'], ALUGUEL: ['ALUGUEL'], PREJUIZOS: ['USO E CONSUMO'], 'FORNECEDORES (CMV)': ['FORNECEDORES'], FRETE: ['FRETE'] };
  const rows = [
    ['REGIME DE CAIXA', ...M],
    L('SALDO INICIAL', '-R$ 4.321,09'),
    L('FATURAMENTO 2025', 'R$ 1.000,00'),
    L('TOTAL DE RECEBIMENTOS', 'R$ 2.000,00', 500),
    L('(PG no mês) Fornecedores CMV', 'R$ 100,00'),
    L('FRETE', 'R$ 50,00', 'R$ -'),
    L('DESPESAS OPERACIONAIS', 'R$ 400,00', 80),
    L('LUCRO LIQUIDO', 'R$ 1.450,00', 420),
    L('PONTO DE EQUILIBRIO', 1),
    L('DESPESAS ADMINISTRATIVA', 'R$ 300,00', 80),
    L('ALUGUEL', 100),
    L('PREJUIZOS', '-', '-'),
    L('DESPESAS ADMINISTRATIVAS', 'R$ 300,00', 80),
    L('CORREIO', 'R$ 120,00', 80),
    L('CONTABILIDADE', 'R$ 170,00'),
    L('PREJUIZOS', null),
    L('USO E CONSUMO', null, 7),
  ];
  it('lê números no formato da planilha', () => {
    expect([numBR('R$ 1.234,56'), numBR('-R$ 4.321,09'), numBR('R$ -'), numBR('-'), numBR('#REF!'), numBR(12.5), numBR(null)]).toEqual([1234.56, -4321.09, 0, 0, 0, 12.5, 0]);
  });
  it('usa os nomes do sistema, fecha com o total da categoria e confere o lucro', () => {
    const r = lerFluxoConsolidado(rows, '2025', listas);
    const jan = r.linhas.filter((l) => l.mes === '2025-01');
    expect(jan.filter((l) => l.tipo === 'opex').map((l) => [l.cat, l.sub, l.valor])).toEqual([
      ['DESPESAS ADMINISTRATIVA', 'CORREIO', 120], ['DESPESAS ADMINISTRATIVA', 'CONTABILIDADE', 170], ['DESPESAS ADMINISTRATIVA', '(sem subcategoria)', 10], ['ALUGUEL', '(sem subcategoria)', 100]]);
    expect(jan.find((l) => l.tipo === 'rec').valor).toBe(2000);
    expect(jan.find((l) => l.tipo === 'saldo').valor).toBe(-4321.09);
    expect(r.meses[0].lucro).toBe(1450);
    expect(r.meses[1].lucro).toBe(420);
    // fevereiro: PREJUIZOS zerado no resumo, o detalhe de 7 fica de fora (como na planilha)
    expect(r.linhas.some((l) => l.mes === '2025-02' && l.cat === 'PREJUIZOS')).toBe(false);
    expect(r.avisos.length).toBe(2);
  });
});
