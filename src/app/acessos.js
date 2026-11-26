// Níveis de acesso: cada perfil libera módulos inteiros; um usuário pode ser personalizado (módulos só dele).
// Guardado na Config "acesso" = { perfis: [{ id, nome, mods }], usuarios: { nome: { perfil, mods|null } } }.
// "cfg" é o módulo de administração: quem tem cfg é administrador também no servidor (Sync.admins).
export const AC_MODS = [['dir', 'Diretoria'], ['fin', 'Financeiro'], ['rh', 'RH'], ['cfg', 'Configurações (admin)']];
export const AC_TELAS = { dir: ['dirr', 'dird', 'dirk', 'rel'], fin: ['pagar', 'of', 'parc', 'pr', 'rel', 'dre', 'drel'], rh: ['rho', 'rhc', 'rhp'], cfg: ['cfg'] };
export const AC_ORDEM = ['dirr', 'dird', 'dirk', 'pagar', 'of', 'parc', 'pr', 'rel', 'dre', 'drel', 'rho', 'rhc', 'rhp', 'cfg'];

export const acModNome = (k) => (AC_MODS.find((m) => m[0] === k) || [k, k])[1];

// Antes de alguém salvar os acessos: administradores com tudo, os demais com Financeiro (como era antes dos perfis).
export function acessoPadrao(usuarios, admins) {
  const A = {
    perfis: [
      { id: 'adm', nome: 'Administrador', mods: ['dir', 'fin', 'rh', 'cfg'] },
      { id: 'fin', nome: 'Financeiro', mods: ['fin'] },
      { id: 'dir', nome: 'Diretoria', mods: ['dir'] },
      { id: 'rh', nome: 'RH', mods: ['rh'] },
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

// Acessos salvos antes do módulo RH (26/11/2026): o perfil Administrador ganha o RH e passa a existir o perfil RH.
// Só muda a cópia em memória; fica gravado quando um administrador salvar os acessos.
export function comRh(A) {
  if (!acessoValido(A)) return A;
  const adm = A.perfis.find((p) => p.id === 'adm');
  if (adm && Array.isArray(adm.mods) && !adm.mods.includes('rh')) adm.mods.splice(Math.max(0, adm.mods.indexOf('cfg')), 0, 'rh');
  if (!A.perfis.some((p) => p.id === 'rh')) A.perfis.push({ id: 'rh', nome: 'RH', mods: ['rh'] });
  return A;
}
