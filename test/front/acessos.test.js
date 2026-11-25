import { describe, it, expect } from 'vitest';
import { acessoPadrao, modsDe, telasDe, comCfg } from '../../src/app/acessos.js';

describe('níveis de acesso', () => {
  const A = acessoPadrao(['Lucca', 'Viviane', 'Cris'], ['Lucca']);
  it('antes de salvar: administrador com tudo, os demais com Financeiro', () => {
    expect(modsDe(A, 'Lucca')).toEqual(['dir', 'fin', 'cfg']);
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
