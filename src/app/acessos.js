// Níveis de acesso: cada perfil libera módulos inteiros; um usuário pode ser personalizado (módulos só dele).
// Guardado na Config "acesso" = { perfis: [{ id, nome, mods }], usuarios: { nome: { perfil, mods|null } } }.
// "cfg" é o módulo de administração: quem tem cfg é administrador também no servidor (Sync.admins).
export const AC_MODS = [['dir', 'Diretoria'], ['fin', 'Financeiro'], ['cfg', 'Configurações (admin)']];
export const AC_TELAS = { dir: ['dirr', 'dird', 'dirk', 'rel'], fin: ['pagar', 'of', 'parc', 'pr', 'rel', 'dre', 'drel'], cfg: ['cfg'] };
export const AC_ORDEM = ['dirr', 'dird', 'dirk', 'pagar', 'of', 'parc', 'pr', 'rel', 'dre', 'drel', 'cfg'];

export const acModNome = (k) => (AC_MODS.find((m) => m[0] === k) || [k, k])[1];

// Antes de alguém salvar os acessos: administradores com tudo, os demais com Financeiro (como era antes dos perfis).
export function acessoPadrao(usuarios, admins) {
  const A = {
    perfis: [
      { id: 'adm', nome: 'Administrador', mods: ['dir', 'fin', 'cfg'] },
      { id: 'fin', nome: 'Financeiro', mods: ['fin'] },
      { id: 'dir', nome: 'Diretoria', mods: ['dir'] },
    ],
    usuarios: {},
  };
  (usuarios || []).forEach((u) => { A.usuarios[u] = { perfil: (admins || []).includes(u) ? 'adm' : 'fin', mods: null }; });
  return A;
}

export const acessoValido = (a) => !!(a && typeof a === 'object' && Array.isArray(a.perfis) && a.usuarios && typeof a.usuarios === 'object');

export function modsDe(A, u) {
  const a = A && A.usuarios && A.usuarios[u];
  if (!a) return [];
  if (Array.isArray(a.mods)) return a.mods;
  const p = (A.perfis || []).find((x) => x.id === a.perfil);
  return p ? p.mods : [];
}

// Configurações sempre aparece (Minha conta); as outras telas vêm dos módulos.
export function telasDe(A, u) {
  const m = modsDe(A, u);
  return AC_ORDEM.filter((t) => t === 'cfg' || m.some((k) => (AC_TELAS[k] || []).includes(t)));
}

// quantos usuários continuam com Configurações (para ninguém trancar o sistema)
export const comCfg = (A, usuarios) => (usuarios || []).filter((u) => modsDe(A, u).includes('cfg')).length;
