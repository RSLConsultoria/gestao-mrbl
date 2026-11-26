import { describe, it, expect } from 'vitest';
import { acessoPadrao, modsDe, telasDe, comCfg } from '../../src/app/acessos.js';

describe('níveis de acesso', () => {
  const A = acessoPadrao(['Lucca', 'Viviane', 'Cris'], ['Lucca']);
  it('antes de salvar: administrador com tudo, os demais com Financeiro', () => {
    expect(modsDe(A, 'Lucca')).toEqual(['dir', 'fin', 'rh', 'cfg']);
    expect(modsDe(A, 'Viviane')).toEqual(['fin']);
    expect(modsDe(A, 'Ninguém')).toEqual([]);
  });
  it('telas vêm dos módulos; Configurações (Minha conta) sempre aparece', () => {
    expect(telasDe(A, 'Viviane')).toEqual(['pagar', 'of', 'parc', 'pr', 'rel', 'dre', 'drel', 'cfg']);
    A.usuarios.Cris = { perfil: 'dir', mods: null };
    expect(telasDe(A, 'Cris')).toEqual(['dirr', 'dird', 'dirk', 'rel', 'cfg']);
    expect(telasDe(A, 'Ninguém')).toEqual(['cfg']);
  });
  it('usuário personalizado ignora o perfil; conta quem tem Configurações', () => {
    A.usuarios.Viviane = { perfil: 'fin', mods: ['fin', 'cfg'] };
    expect(modsDe(A, 'Viviane')).toEqual(['fin', 'cfg']);
    expect(comCfg(A, ['Lucca', 'Viviane', 'Cris'])).toBe(2);
  });
});

describe('módulo RH', () => {
  it('perfil RH vê Organograma, Custos e Colaboradores; acessos antigos ganham o RH no administrador', async () => {
    const { comRh } = await import('../../src/app/acessos.js');
    const A = acessoPadrao(['Lucca', 'Ana'], ['Lucca']);
    A.usuarios.Ana = { perfil: 'rh', mods: null };
    expect(telasDe(A, 'Ana')).toEqual(['rho', 'rhc', 'rhp', 'cfg']);
    const antigo = { perfis: [{ id: 'adm', nome: 'Administrador', mods: ['dir', 'fin', 'cfg'] }, { id: 'fin', nome: 'Financeiro', mods: ['fin'] }], usuarios: { Lucca: { perfil: 'adm', mods: null } } };
    comRh(antigo);
    expect(antigo.perfis[0].mods).toEqual(['dir', 'fin', 'rh', 'cfg']);
    expect(antigo.perfis.map((p) => p.id)).toEqual(['adm', 'fin', 'rh']);
    expect(telasDe(antigo, 'Lucca')).toContain('rhp');
  });
});
