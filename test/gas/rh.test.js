import { describe, it, expect } from 'vitest';
import { carregarServidor, chamar } from './carregar.js';

// Dados fictícios (repositório público).
function logado() {
  const g = carregarServidor();
  for (const [n, c] of [['Lucca', 'L1'], ['Viviane', 'V1'], ['Ana', 'A1']]) g.Db.inserir('Usuarios', { nome: n, convite: c, ativo: true });
  const tok = {};
  for (const [n, c] of [['Lucca', 'L1'], ['Viviane', 'V1'], ['Ana', 'A1']]) tok[n] = chamar(g, 'auth.criarSenha', { nome: n, convite: c, senha: 'senha123' }).dados.token;
  return { g, tok };
}
const pessoa = (id, extra) => ({ id, nome: 'PESSOA ' + id, apel: '', loc: 'BP', adm: '2024-01-10', fn: 'COSTUREIRO(A)', setor: 'COSTURA', lid: '', sal: 2000, pr: 0, vinc: 'clt', pa: 'prod', prov: null, sit: 'ativo', ate: '', nota: '', log: [{ em: '2026-11-26T10:00', por: '', txt: 'Importado' }], ...extra });
const acesso = { perfis: [{ id: 'adm', nome: 'Administrador', mods: ['dir', 'fin', 'rh', 'cfg'] }, { id: 'fin', nome: 'Financeiro', mods: ['fin'] }, { id: 'rh', nome: 'RH', mods: ['rh'] }],
  usuarios: { Lucca: { perfil: 'adm', mods: null }, Viviane: { perfil: 'fin', mods: null }, Ana: { perfil: 'rh', mods: null } } };

describe('RH: colaboradores só para quem tem o módulo RH', () => {
  it('administrador grava e lê; quem não tem RH não recebe os colaboradores nem a configuração do RH', () => {
    const { g, tok } = logado();
    let r = chamar(g, 'sync.aplicar', { tela: 'rhp', msg: 'Importado', mud: { Colaboradores: { up: [pessoa('c1', { prov: { d13: true, fer: false, ter: false, multa: false }, vinc: 'pj' })] }, Config: { rhCfg: { regime: 'guia', guia: 1000 } } } }, tok.Lucca);
    expect(r.ok).toBe(true);
    const d = chamar(g, 'dados.carregar', {}, tok.Lucca).dados;
    expect(d.rh).toBe(true);
    expect(d.colaboradores).toHaveLength(1);
    expect(d.colaboradores[0]).toMatchObject({ id: 'c1', vinc: 'pj', sal: 2000, prov: { d13: true, fer: false } });
    expect(d.config.rhCfg).toEqual({ regime: 'guia', guia: 1000 });
    const v = chamar(g, 'dados.carregar', {}, tok.Viviane).dados;
    expect(v.rh).toBe(false);
    expect(v.colaboradores).toBeUndefined();
    expect(v.config.rhCfg).toBeUndefined();
  });
  it('quem não tem RH não grava colaboradores nem a configuração do RH', () => {
    const { g, tok } = logado();
    let r = chamar(g, 'sync.aplicar', { mud: { Colaboradores: { up: [pessoa('c1')] } } }, tok.Viviane);
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('sem_permissao');
    r = chamar(g, 'sync.aplicar', { mud: { Config: { rhOrgPos: { emp: { x: 1, y: 2 } } } } }, tok.Viviane);
    expect(r.codigo).toBe('sem_permissao');
    expect(g.Db.todos('Colaboradores')).toHaveLength(0);
  });
  it('perfil RH (sem ser administrador) lê e grava, depois que os acessos são salvos', () => {
    const { g, tok } = logado();
    expect(chamar(g, 'sync.aplicar', { mud: { Config: { acesso } } }, tok.Lucca).ok).toBe(true);
    let r = chamar(g, 'sync.aplicar', { tela: 'rhp', mud: { Colaboradores: { up: [pessoa('c2')] } } }, tok.Ana);
    expect(r.ok).toBe(true);
    expect(chamar(g, 'dados.carregar', {}, tok.Ana).dados.colaboradores.map((p) => p.id)).toEqual(['c2']);
    expect(chamar(g, 'dados.carregar', {}, tok.Viviane).dados.colaboradores).toBeUndefined();
    r = chamar(g, 'sync.aplicar', { mud: { Colaboradores: { del: ['c2'] } } }, tok.Ana);
    expect(r.ok).toBe(true);
    expect(g.Db.todos('Colaboradores')).toHaveLength(0);
  });
});
