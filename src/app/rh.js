// RH: Organograma, Custos e Colaboradores, portados do protótipo aprovado (26/11/2026).
// Dados: aba Colaboradores (importada da planilha "Geral colaboradores" em Configurações › RH) e as configurações
// rhCfg (encargos e benefícios) e rhOrgPos (posições do organograma). O servidor só manda e só aceita esses dados
// de quem tem o módulo RH. Custo pela metodologia do estudo "Custo da folha MRBL — nov/2026".
/* eslint-disable */
export const RH_TELAS = ['rho', 'rhc', 'rhp'];
export const RH_TITULO = { rho: 'Organograma', rhc: 'Custos', rhp: 'Colaboradores' };

// ---------- leitura da planilha (regras puras, testadas em test/front/rh.test.js) ----------
const up = (t) => String(t == null ? '' : t).toUpperCase().replace(/\s+/g, ' ').trim();
const semAc = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const RH_COLS = { nome: 'NOME', loc: 'LOCAL', adm: 'ADMISSAO', fn: 'FUNCAO', setor: 'SETOR', lid: 'LIDER', sal: 'SALARIO', pr: 'PREMIO FIXO', obs: 'OBS', pa: 'PRODUCAO/ADM', vinc: 'CLT OU PJ', d13: 'TEM 13' };
const RH_LOCS = { MTZ: 'BP', SPO: 'SP', TOLEDO: 'TOL', BP: 'BP', SP: 'SP', 'BRAGANCA PAULISTA': 'BP', 'SAO PAULO': 'SP' };
const numRh = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; const t = String(v).replace(/R\$|\s|\u00a0/g, ''); if (!t) return null; const x = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return isFinite(x) ? x : null; };
const dataRh = (v) => {
  if (v instanceof Date) return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0');
  const t = String(v == null ? '' : v).trim(); if (/^\d{4}-\d\d-\d\d/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); return m ? (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
};
export function rhSitDeObs(o){
  o = String(o || '');
  const m = o.match(/até (?:o dia )?(\d\d)\/(\d\d)(?:\/(\d{4}))?/i), ate = m ? (m[3] || String(new Date().getFullYear())) + '-' + m[2] + '-' + m[1] : '';
  const sit = /f[ée]rias/i.test(o) ? 'ferias' : /afastad/i.test(o) ? 'afastado' : /licen/i.test(o) ? 'licenca' : /aviso/i.test(o) ? 'aviso' : /gr[aá]vida/i.test(o) ? 'gestante' : 'ativo';
  return { sit, ate: sit === 'ativo' ? '' : ate };
}
// Linhas da aba (listas de valores; a primeira linha com NOME e LIDER é o cabeçalho) -> pessoas.
// Coluna "TEM 13º/FÉRIAS?" (só PJ): SIM = 13º e férias com 1/3; APENAS/SÓ 13º = só 13º; NÃO ou vazio = nada.
export function lerColaboradores(linhas){
  const hi = linhas.findIndex((r) => r && r.some((c) => semAc(c) === 'NOME') && r.some((c) => semAc(c) === 'LIDER'));
  if (hi < 0) throw new Error('Não achei o cabeçalho (colunas NOME e LIDER) na planilha.');
  const H = linhas[hi].map(semAc), col = {};
  Object.entries(RH_COLS).forEach(([k, n]) => { col[k] = H.findIndex((h) => k === 'd13' ? h.startsWith(n) : h === n); });
  const falta = ['nome', 'loc', 'setor', 'lid', 'sal', 'vinc'].filter((k) => col[k] < 0);
  if (falta.length) throw new Error('Faltam colunas na planilha: ' + falta.map((k) => RH_COLS[k]).join(', ') + '.');
  const avisos = [], out = [];
  linhas.slice(hi + 1).forEach((r) => {
    if (!r) return; const g = (k) => col[k] < 0 ? null : r[col[k]];
    const nome = up(g('nome')); if (!nome) return;
    const locT = semAc(g('loc')), loc = RH_LOCS[locT];
    if (!loc) avisos.push(nome + ': unidade "' + (g('loc') || '') + '" desconhecida (ficou Bragança)');
    const vinc = semAc(g('vinc')) === 'PJ' ? 'pj' : 'clt', t = semAc(g('d13'));
    let prov = null;
    if (vinc === 'pj') {
      if (t === 'SIM') prov = { d13: true, fer: true, ter: true, multa: false };
      else if (/^(APENAS|SO) 13/.test(t)) prov = { d13: true, fer: false, ter: false, multa: false };
      else { prov = { d13: false, fer: false, ter: false, multa: false }; if (!t) avisos.push(nome + ': PJ sem resposta em 13º/férias (ficou sem)'); }
    }
    const obs = String(g('obs') || '').replace(/\s+/g, ' ').trim(), s = rhSitDeObs(obs);
    out.push({ nome, loc: loc || 'BP', adm: dataRh(g('adm')), fn: up(g('fn')), setor: up(g('setor')), lidNome: semAc(g('lid')), sal: numRh(g('sal')), pr: numRh(g('pr')) || 0,
      vinc, pa: /^ADM/.test(semAc(g('pa'))) ? 'adm' : 'prod', prov, nota: obs, sit: s.sit, ate: s.ate });
  });
  const nomes = new Set(out.map((p) => semAc(p.nome)));
  out.forEach((p) => { if (p.lidNome && !nomes.has(p.lidNome)) avisos.push(p.nome + ': líder "' + p.lidNome + '" não está na lista'); });
  return { pessoas: out, avisos };
}
// Junta a planilha com o cadastro atual pelo nome: quem já existe mantém id, apelido e linha do tempo; o resto vem da
// planilha. Quem não está na planilha sai. Devolve a lista nova e o que mudou.
export function mesclarColaboradores(atuais, lidas, em, por){
  const porNome = new Map((atuais || []).map((p) => [semAc(p.nome), p]));
  let seq = Math.max(0, ...(atuais || []).map((p) => +String(p.id).replace(/\D/g, '') || 0));
  const novos = [], mudados = [], ids = new Map();
  lidas.forEach((l) => { const a = porNome.get(semAc(l.nome)); ids.set(semAc(l.nome), a ? a.id : 'c' + String(++seq).padStart(3, '0')); });
  const ppl = lidas.map((l) => {
    const a = porNome.get(semAc(l.nome)), id = ids.get(semAc(l.nome));
    const p = { id, nome: l.nome, apel: a ? a.apel || '' : '', loc: l.loc, adm: l.adm, fn: l.fn, setor: l.setor, lid: l.lidNome ? ids.get(l.lidNome) || '' : '', sal: l.sal, pr: l.pr,
      vinc: l.vinc, pa: l.pa, prov: l.prov, sit: l.sit, ate: l.ate, nota: l.nota, log: a ? (a.log || []).slice() : [] };
    const txt = a ? 'Atualizado pela planilha Geral colaboradores' : 'Veio da planilha Geral colaboradores (' + (l.vinc === 'pj' ? 'PJ' : 'CLT') + ', ' + (l.pa === 'adm' ? 'administrativo' : 'produção') + ')';
    const chaves = ['loc', 'adm', 'fn', 'setor', 'lid', 'sal', 'pr', 'vinc', 'pa', 'sit', 'ate'];
    const mudou = !a || chaves.some((k) => String(a[k] == null ? '' : a[k]) !== String(p[k] == null ? '' : p[k])) || JSON.stringify(a.prov || null) !== JSON.stringify(p.prov || null);
    if (!a) novos.push(p); else if (mudou) mudados.push(p);
    if (mudou) p.log.push({ em, por, txt });
    return p;
  });
  const saem = (atuais || []).filter((a) => !lidas.some((l) => semAc(l.nome) === semAc(a.nome)));
  return { ppl, novos, mudados, saem };
}

export function criarRh(ctx){
const { view, render, act, toast, esc, money, dmy, dm, parse, iso, addDays, agora, quando, HOJE } = ctx;
const S_ = () => ctx.getS();
const save = () => ctx.save();
const int = (v) => Math.round(v || 0).toLocaleString('pt-BR');
const cpNorm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const cpErr = (msg) => { const e = document.getElementById('cpErr'); if (e) e.textContent = msg; else toast(msg, false); };
const LIXO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
const XSVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const pxInfo = (L) => '<div class="cpinfo">' + L.map(([k, v]) => '<div><span>' + k + '</span><b>' + (v == null || v === '' ? '—' : v) + '</b></div>').join('') + '</div>';
const selF = (id, lab, opts, val) => '<label class="cpsel"><span>' + lab + '</span><select id="' + id + '">' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
const cpObs = (id) => '<label class="ff cpobs"><span>Observação</span><textarea id="' + id + '" rows="3" placeholder="Escreva uma observação. Ao salvar, ela entra na linha do tempo com seu nome."></textarea></label>';
const cpTl = (log, vazio) => '<div class="tlbox"><h3>Linha do tempo</h3><div class="tlscroll"><ol class="tl">' + ((log || []).slice().reverse().map((l, k, a) => '<li class="' + (/^Obs: /.test(l.txt) ? 'n' : 'e') + (k === a.length - 1 ? ' last' : '') + '">' + (/^Obs: /.test(l.txt) ? '<span class="tln">' + esc(l.txt.slice(5)) + '</span>' : '<b>' + esc(l.txt) + '</b>') + '<small>' + quando(l.em) + (l.por ? ' por <span class="who">' + esc(l.por) + '</span>' : '') + '</small></li>').join('') || '<li class="e last"><b>' + esc(vazio || 'Sem eventos ainda') + '</b></li>') + '</ol></div></div>';
function cpShell(sobre, tit, corpo, foot, cls){
  return '<div class="modal-bg cpbg" data-modal-bg><div class="modal cpm ' + (cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="cpmt"><div class="mh">' + (sobre ? '<small class="cpsobre">' + esc(sobre) + '</small>' : '') + '<h2 id="cpmt">' + tit + '</h2><button type="button" class="mx" data-modal-close aria-label="Fechar">' + XSVG + '</button></div>' +
    '<div class="ebody">' + corpo + '</div>' + (foot ? '<div class="efoot"><span id="cpErr" class="err" role="alert"></span><div class="fact">' + foot + '</div></div>' : '') + '</div></div>';
}
const rhTela = () => RH_TELAS.includes(view.tela);

const RH_LOC = { BP: 'Bragança Paulista', SP: 'São Paulo', TOL: 'Toledo', EXT: 'Externo' }, RH_LOCC = { BP: 'Bragança', SP: 'São Paulo', TOL: 'Toledo', EXT: 'Externo' };
const RH_PA = { prod: 'Produção', adm: 'Administrativo' };
const rhLocSig = (l) => ({ SP: 'SP', BP: 'BRG', TOL: 'TOL' })[l] || 'EXT';
const RH_SIT = [['ativo', 'Ativo'], ['ferias', 'De férias'], ['afastado', 'Afastado'], ['licenca', 'Licença-maternidade'], ['aviso', 'Aviso prévio'], ['gestante', 'Gestante']];
const RH_REG = [['guia', 'Guia fixa mensal: INSS patronal, RAT, Terceiros e CPRB'], ['geral', 'Regime geral (INSS patronal 20%)'], ['deson', 'Desoneração 2026 (10% sobre a folha, sem 13º)'], ['simples', 'Simples Nacional (sem INSS patronal na folha)']];
const rhSitNome = (k) => (RH_SIT.find((s) => s[0] === k) || ['', 'Ativo'])[1];
const rhMin = (w) => ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(w);
const rhNome = (n) => String(n || '').toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => (i && rhMin(w.toUpperCase())) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const rhCurto = (n) => { const w = rhNome(n).split(' '); return w.length > 2 ? w[0] + ' ' + w[w.length - 1] : w.join(' '); };
const rhFn = (f) => { const s = String(f || '').toLowerCase().replace(/\s*\(\s*a\s*\)/g, '(a)').replace(/\(eira\)/, '(eira)'); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
const rhSetor = (s) => { s = String(s || '').toLowerCase(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sem setor'; };
const rhR = (v) => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');
const rhOrgNome = (p) => String(p.apel || '').trim() || rhCurto(p.nome);

// Vale-alimentação por unidade: f = fixo; c = só com no máximo o limite de atestado/declaração no mês; p = prêmio por não faltar nada.
// Os valores ficam em Configurações (Custos › Encargos e benefícios), na planilha; aqui só o formato (repositório público).
const RH_VA_PAD = { BP: { f: 0, c: 0, p: 0 }, SP: { f: 0, c: 0, p: 0 }, TOL: { f: 0, c: 0, p: 0 } };
const RH_VA_REGRA = { BP: 'até 1 atestado e 1 declaração no mês', SP: 'no máximo 1 atestado ou 1 declaração no mês', TOL: 'no máximo 1 atestado ou 1 declaração no mês' };
const rhVaDe = (loc) => { const u = (S_().rhCfg.vaU || RH_VA_PAD); return u[loc] || u.SP || RH_VA_PAD.SP; };
// Metodologia do estudo de custo da folha: guia fixa mensal, VT por unidade, outros benefícios rateados. Valores digitados
// em Custos › Encargos e benefícios (gravados na Config rhCfg); o padrão só traz as alíquotas legais.
const RH_CFG_PAD = { regime: 'guia', guia: 0, cpp: 20, rat: 2, terc: 5.8, fgts: 8, multa: false, vt: 0, va: 0, saude: 0, outros: 0, pctCond: 100, vtU: { SP: 0, BP: 0, TOL: 0 } };
function ensureRh(){
  const S = S_();
  if (!Array.isArray(S.colaboradores)) S.colaboradores = [];
  if (!S.rhCfg || typeof S.rhCfg !== 'object') S.rhCfg = JSON.parse(JSON.stringify(RH_CFG_PAD));
  if (!S.rhCfg.vaU) S.rhCfg.vaU = JSON.parse(JSON.stringify(RH_VA_PAD));
  if (!S.rhOrgPos || typeof S.rhOrgPos !== 'object') S.rhOrgPos = {};
  S.colaboradores.forEach((p) => { if (!p.log) p.log = []; if (!p.sit) p.sit = 'ativo'; if (!p.vinc) p.vinc = 'clt'; if (!p.pa) p.pa = 'prod'; p.sal = p.sal == null || p.sal === '' ? null : +p.sal; p.pr = +p.pr || 0; });
}
const rhV = () => (view.rh = view.rh || { org: { modo: 'hier', loc: '', open: {} }, c: { grp: 'setor', loc: '' }, f: { loc: '', modo: 'saldo' }, p: { q: '', loc: '', setor: '', sit: '', pa: '' }, tab: 'custo', res: { tipo: 'sem', data: HOJE } });
const rhAtivos = () => S_().colaboradores;
const rhById = (id) => S_().colaboradores.find((p) => p.id === id);

// ---------- datas ----------
const rhD = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
function rhMeses(a, b){ // meses completos com regra dos 15 dias (para 13º e férias proporcionais)
  if (!a || !b || b < a) return 0;
  let n = 0, d = parse(a); const fim = parse(b);
  while (true) { const nx = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()); if (nx - 864e5 <= fim) { n++; d = nx; } else break; }
  if (rhD(iso(d), b) + 1 >= 15) n++;
  return n;
}
function rhAnos(a, b){ if (!a) return 0; const x = parse(a), y = parse(b); let n = y.getFullYear() - x.getFullYear(); if (y.getMonth() < x.getMonth() || (y.getMonth() === x.getMonth() && y.getDate() < x.getDate())) n--; return Math.max(0, n); }
function rhCasa(a){ if (!a) return '—'; const m = Math.max(0, Math.floor(rhD(a, HOJE) / 30.44)), y = Math.floor(m / 12), r = m % 12; return y ? y + (y === 1 ? ' ano' : ' anos') + (r ? ' e ' + r + (r === 1 ? ' mês' : ' meses') : '') : r + (r === 1 ? ' mês' : ' meses'); }

// ---------- custo mensal ----------
// O que entra de provisão para a pessoa. CLT: tudo marcado (multa segue o padrão da empresa). PJ: nada, até marcar.
function rhProv(p){ const pj = p.vinc === 'pj', d = { d13: !pj, fer: !pj, ter: !pj, multa: !pj && !!S_().rhCfg.multa }; return Object.assign(d, p.prov || {}, pj ? { multa: false } : {}); }
const rhNoCusto = (p) => p.vinc !== 'pj' && p.sal != null && p.sit !== 'afastado';
function rhBases(){ const b = { rem: 0, n: 0, loc: {} }; S_().colaboradores.forEach((x) => { if (!rhNoCusto(x)) return; b.rem += (+x.sal || 0) + (+x.pr || 0); b.n++; b.loc[x.loc] = (b.loc[x.loc] || 0) + 1; }); return b; }
function rhCusto(p){
  if (p.sal == null) return null;
  if (p.vinc !== 'pj' && p.sit === 'afastado') { const z = { fora: true, sal: +p.sal || 0, pr: +p.pr || 0, rem: 0, d13: 0, fer: 0, pj: false, pv: rhProv(p), cpp: 0, rat: 0, terc: 0, guia: 0, fgts: 0, multa: 0, vaF: 0, vaC: 0, vaP: 0, vt: 0, outros: 0, saude: 0, ben: 0, enc: 0, prov: 0, total: 0, fator: 0 }; return z; }
  const c = S_().rhCfg, pj = p.vinc === 'pj', pv = rhProv(p), rem = (+p.sal || 0) + (+p.pr || 0), d13 = pv.d13 ? rem / 12 : 0, fer = pv.fer ? rem / 12 * (pv.ter ? 4 / 3 : 1) : 0;
  const gu = c.regime === 'guia', simp = c.regime === 'simples' || gu || pj, cpp = simp ? 0 : c.regime === 'deson' ? 10 : +c.cpp || 20, rat = simp ? 0 : +c.rat || 0, terc = simp ? 0 : +c.terc || 0, f = pj ? 0 : (+c.fgts || 8) / 100, B = rhBases();
  const o = { sal: +p.sal || 0, pr: +p.pr || 0, rem, d13, fer, pj, pv };
  o.cpp = cpp / 100 * (rem + fer + (c.regime === 'deson' ? 0 : d13));
  o.rat = rat / 100 * (rem + fer + d13); o.terc = terc / 100 * (rem + fer + d13);
  o.guia = gu && !pj && B.rem ? (+c.guia || 0) * rem / B.rem : 0;
  o.fgts = f * (rem + fer + d13); o.multa = pv.multa ? o.fgts * 0.4 : 0;
  const va = rhVaDe(p.loc);
  const pc = (c.pctCond == null ? 100 : +c.pctCond) / 100, nU = B.loc[p.loc] || 0;
  o.vaF = pj ? 0 : +va.f || 0; o.vaC = pj ? 0 : (+va.c || 0) * pc; o.vaP = pj ? 0 : (+va.p || 0) * pc;
  o.vtU = pj || !nU ? 0 : (+((c.vtU || {})[p.loc]) || 0) / nU; o.vt = pj ? 0 : o.vtU + Math.max(0, (+c.vt || 0) - 0.06 * o.sal);
  o.outros = pj || !B.n ? 0 : (+c.outros || 0) / B.n; o.saude = pj ? 0 : +c.saude || 0;
  o.ben = o.vaF + o.vaC + o.vaP + o.vt + o.outros + o.saude;
  o.enc = o.cpp + o.rat + o.terc + o.guia + o.fgts; o.prov = o.d13 + o.fer + o.multa;
  o.total = rem + o.enc + o.prov + o.ben; o.fator = rem ? o.total / rem : 0;
  return o;
}

// ---------- hierarquia ----------
function rhArvore(loc){
  const P = rhAtivos(), kids = {}, has = new Set(P.map((p) => p.id));
  P.forEach((p) => { const k = p.lid && has.has(p.lid) ? p.lid : ''; (kids[k] = kids[k] || []).push(p); });
  const memo = {};
  const sub = (id) => { if (memo[id]) return memo[id]; const L = []; (kids[id] || []).forEach((k) => { L.push(k); L.push(...sub(k.id)); }); return (memo[id] = L); };
  const vis = (p) => !loc || p.loc === loc || sub(p.id).some((x) => x.loc === loc);
  return { kids, sub, vis };
}
const rhCustoDe = (L) => L.reduce((a, p) => { const c = rhCusto(p); return a + (c ? c.total : 0); }, 0);

// ---------- telas ----------
function rhHead(t, sub){ return '<div class="today"><h1>' + t + '</h1><span class="sub">' + sub + '</span></div>'; }
function rhSeg(k, v, ops){ return '<div class="seg sm" role="tablist">' + ops.map(([id, nm]) => '<button type="button" role="tab" data-rh="' + k + ':' + id + '" aria-selected="' + (v === id) + '">' + nm + '</button>').join('') + '</div>'; }
const rhLocSeg = (k, v) => rhSeg(k, v, [['', 'Todas as unidades'], ['BP', 'Bragança Paulista'], ['SP', 'São Paulo']]);
function rhKpiGeral(L){
  const cs = L.map(rhCusto).filter(Boolean), tot = cs.reduce((a, c) => a + c.total, 0), fol = cs.reduce((a, c) => a + c.rem, 0);
  const bp = L.filter((p) => p.loc === 'BP').length, sp = L.filter((p) => p.loc === 'SP').length, ou = L.length - bp - sp, pjN = L.filter((p) => p.vinc === 'pj').length, admN = L.filter((p) => p.pa === 'adm').length;
  const lid = new Set(L.map((p) => p.lid).filter(Boolean)).size, sem = L.filter((p) => p.sal == null).length;
  return '<div class="pxkpi rhkpi"><div><span>Pessoas</span><b class="num">' + L.length + '</b><small>' + (L.length - admN) + ' produção · ' + admN + ' administrativo</small></div>' +
    '<div><span>Setores · líderes</span><b class="num">' + new Set(L.map((p) => p.setor).filter(Boolean)).size + '</b><small>' + lid + ' pessoas com equipe</small></div>' +
    '<div><span>Folha por mês</span><b class="num pxkv">' + rhR(fol) + '</b><small>' + (L.length - pjN) + ' CLT · ' + pjN + ' PJ' + (sem ? ' · ' + sem + ' sem valor' : '') + (L.filter((p) => p.vinc !== 'pj' && p.sit === 'afastado').length ? ' · ' + L.filter((p) => p.vinc !== 'pj' && p.sit === 'afastado').length + ' afastados fora' : '') + '</small></div>' +
    '<div><span>Custo total</span><b class="num pxkv">' + rhR(tot) + '</b><small>' + (fol ? (tot / fol).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '× a folha, por mês' : '') + '</small></div></div>';
}

// Organograma
// Organograma desenhado por posição: cada caixinha é um nó solto (position absolute), as linhas são SVG.
// view.rhOrgM guarda o modelo da última renderização (pai e filhos de cada nó) para o layout e o arraste.
function rhOrgModelo(V, T, L, topo){
  const M = { kids: { emp: [] }, par: {}, html: {} }, add = (id, pai, html) => { M.html[id] = html; M.kids[id] = M.kids[id] || []; if (pai) { M.par[id] = pai; M.kids[pai].push(id); } };
  add('emp', '', '<div class="rhno rhemp" data-node="emp"><b>MRBL Confecções</b><span>' + (V.loc ? RH_LOC[V.loc] : 'Todas as unidades') + '</span><small>' + L.length + ' pessoas · ' + rhR(rhCustoDe(L)) + '/mês</small></div>');
  const rec = (p, pai) => {
    const id = 'p:' + p.id, sub = T.sub(p.id), cus = rhCusto(p), k = (T.kids[p.id] || []).filter(T.vis);
    const lideres = k.filter((x) => (T.kids[x.id] || []).length), equipe = k.filter((x) => !(T.kids[x.id] || []).length);
    add(id, pai, '<div class="rhno' + (p.sug ? ' sug' : '') + '" data-node="' + id + '" data-rhid="' + p.id + '" tabindex="0" role="button"><b>' + esc(rhOrgNome(p)) + '</b><span>' + esc(rhFn(p.fn)) + '</span><small><i class="rhloc ' + p.loc + '">' + rhLocSig(p.loc) + '</i>' + (p.vinc === 'pj' ? '<i class="rhpj">PJ</i>' : '') + (sub.length ? sub.length + (sub.length === 1 ? ' pessoa' : ' pessoas') : '') + '</small><small class="rhnc rhv"><span>Pessoa</span><b>' + (cus ? rhR(cus.total) + '/mês' : 'sem valor') + '</b></small>' + (sub.length ? '<small class="rhnc rhv"><span>Equipe</span><b>' + rhR(rhCustoDe(sub)) + '/mês</b></small>' : '') + '</div>');
    lideres.forEach((x) => rec(x, id));
    if (equipe.length) { const op = V.open[p.id], setores = [...new Set(equipe.map((x) => rhSetor(x.setor)))], eid = 'e:' + p.id;
      add(eid, id, '<div class="rheq' + (op ? ' op' : '') + '" data-node="' + eid + '"><button type="button" class="rheq-h" data-rh="eq:' + p.id + '" aria-expanded="' + !!op + '"><b>' + (lideres.length ? 'Equipe direta' : 'Equipe') + ' · ' + equipe.length + '</b><span>' + esc(setores.slice(0, 3).join(', ') + (setores.length > 3 ? '…' : '')) + '</span><small>' + rhR(rhCustoDe(equipe)) + '/mês</small></button>' +
        (op ? '<ol>' + equipe.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((x) => '<li data-rhid="' + x.id + '" class="' + (x.sit !== 'ativo' ? 'fora' : '') + '"><span>' + esc(rhOrgNome(x)) + '</span><small>' + esc(rhFn(x.fn)) + (x.sit !== 'ativo' ? ' · ' + rhSitNome(x.sit) : '') + '</small></li>').join('') + '</ol>' : '') + '</div>'); }
  };
  topo.forEach((p) => rec(p, 'emp'));
  return M;
}
const RH_GX = 22, RH_GY = 46;
// Mede as caixinhas e calcula a posição de cada uma (árvore de cima para baixo, pai centralizado sobre os filhos).
function rhOrgMede(){
  const M = view.rhOrgM, el = document.getElementById('rhOrg'); if (!M || !el) return;
  M.w = {}; M.h = {}; el.querySelectorAll('[data-node]').forEach((n) => { M.w[n.dataset.node] = n.offsetWidth; M.h[n.dataset.node] = n.offsetHeight; });
  const sw = {}, larg = (id) => { if (sw[id] != null) return sw[id]; const k = M.kids[id] || []; const kw = k.reduce((a, c) => a + larg(c), 0) + RH_GX * Math.max(0, k.length - 1); return (sw[id] = Math.max(M.w[id] || 0, kw)); };
  M.base = {};
  const pos = (id, left, top) => { const k = M.kids[id] || [], w = larg(id); let x = left + (w - (M.w[id] || 0)) / 2;
    if (k.length) { const kw = k.reduce((a, c) => a + larg(c), 0) + RH_GX * (k.length - 1); let cx = left + (w - kw) / 2; const cs = []; k.forEach((c) => { pos(c, cx, top + (M.h[id] || 0) + RH_GY); cs.push(M.base[c].x + M.w[c] / 2); cx += larg(c) + RH_GX; }); x = (cs[0] + cs[cs.length - 1]) / 2 - (M.w[id] || 0) / 2; }
    M.base[id] = { x, y: top }; };
  pos('emp', 0, 0);
  rhOrgPosiciona();
}
// Aplica deslocamentos salvos (cada nó leva junto quem está embaixo dele) e redesenha as linhas.
function rhOrgPosiciona(){
  const M = view.rhOrgM, el = document.getElementById('rhOrg'); if (!M || !M.base || !el) return;
  const off = (S_().rhOrgPos = S_().rhOrgPos || {}), tmp = view.rhOrgTmp || {}, P = {};
  const go = (id, ax, ay) => { const o = tmp[id] || off[id] || { x: 0, y: 0 }, dx = ax + o.x, dy = ay + o.y; P[id] = { x: M.base[id].x + dx, y: M.base[id].y + dy }; (M.kids[id] || []).forEach((c) => go(c, dx, dy)); };
  go('emp', 0, 0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  el.querySelectorAll('[data-node]').forEach((n) => { const id = n.dataset.node, p = P[id]; if (!p) return; n.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + M.w[id]); y1 = Math.max(y1, p.y + M.h[id]); });
  M.P = P; M.box = { x0, y0, x1, y1 };
  let d = '';
  Object.keys(M.par).forEach((c) => { const p = M.par[c], a = P[p], b = P[c]; if (!a || !b) return;
    const ax = a.x + M.w[p] / 2, ay = a.y + M.h[p], bx = b.x + M.w[c] / 2, by = b.y, my = by > ay ? ay + Math.min(RH_GY / 2, (by - ay) / 2) : ay + 12;
    d += 'M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'V' + my.toFixed(1) + 'H' + bx.toFixed(1) + 'V' + by.toFixed(1); });
  const sv = document.getElementById('rhLinks'); if (sv) sv.innerHTML = '<path d="' + d + '"/>';
}
function rhRenderOrg(){
  const V = rhV().org, L = rhAtivos().filter((p) => !V.loc || p.loc === V.loc);
  let h = rhHead('Organograma', 'Onde cada pessoa está e a quem responde, nas duas unidades');
  h += '<div class="cptool">' + rhSeg('omodo', V.modo, [['hier', 'Hierarquia'], ['setor', 'Por setor']]) + rhLocSeg('oloc', V.loc) + '<span class="grow"></span>' + (V.modo === 'hier' ? '<button type="button" class="btn ghost" data-rh="eqall">' + (Object.keys(V.open).length ? 'Recolher equipes' : 'Abrir todas as equipes') + '</button>' : '') + '</div>';
  h += rhKpiGeral(L);
  if (V.modo === 'setor') return h + rhPorSetor(L);
  const T = rhArvore(V.loc), raiz = (T.kids[''] || []).filter(T.vis), rhTopo = (p) => (T.kids[p.id] || []).length || String(p.setor).toUpperCase() === 'DIRETORIA', topo = raiz.filter(rhTopo), soltos = raiz.filter((p) => !rhTopo(p));
  view.rhOrgM = rhOrgModelo(V, T, L, topo);
  const temPos = Object.keys(S_().rhOrgPos || {}).length;
  h += '<section class="panel rhcanvas"><div class="rhzoom" role="toolbar" aria-label="Zoom do organograma"><button type="button" data-rh="orgReset"' + (temPos ? '' : ' hidden') + ' title="Volta as caixinhas para o lugar automático">Reorganizar</button><button type="button" data-rh="zoom:out" aria-label="Diminuir zoom">−</button><span id="rhZp">100%</span><button type="button" data-rh="zoom:in" aria-label="Aumentar zoom">+</button><i></i><button type="button" data-rh="zoom:fit">Ver tudo</button><button type="button" data-rh="zoom:1">100%</button></div>' +
    '<div class="rhvp" id="rhVp" tabindex="0" aria-label="Organograma: arraste o fundo para mover, arraste uma caixinha para mudar de lugar, roda do mouse ou + e − para zoom"><div class="rhcv" id="rhOrg"><svg id="rhLinks" class="rhlk" width="1" height="1" aria-hidden="true"></svg>' + Object.values(view.rhOrgM.html).join('') + '</div></div><p class="rhdica">Arraste o fundo para mover · arraste uma caixinha para mudar de lugar (a equipe vai junto) · roda do mouse ou + e − para zoom</p></section>';
  if (soltos.length) h += '<section class="panel"><div class="ph"><div><h2>Sem líder na planilha · ' + soltos.length + '</h2><small style="color:var(--muted);display:block">Abra a pessoa e escolha o líder para ela entrar no organograma.</small></div></div><div class="rhsolto">' + soltos.map((p) => '<button type="button" data-rhid="' + p.id + '"><b>' + esc(rhOrgNome(p)) + '</b><span>' + esc(rhFn(p.fn) || (p.soFer ? 'Só no relatório de férias' : '—')) + ' · ' + (RH_LOC[p.loc] || '') + '</span></button>').join('') + '</div></section>';
  return h;
}
function rhPorSetor(L){
  const g = new Map(); L.forEach((p) => { const k = p.setor || ''; if (!g.has(k)) g.set(k, []); g.get(k).push(p); });
  const tot = rhCustoDe(L) || 1;
  const cards = [...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([s, ps]) => {
    const cus = rhCustoDe(ps), lc = {}; ps.forEach((p) => { if (p.lid) lc[p.lid] = (lc[p.lid] || 0) + 1; });
    const lids = Object.entries(lc).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => rhById(id)).filter(Boolean);
    const fns = {}; ps.forEach((p) => { const f = rhFn(p.fn) || '—'; fns[f] = (fns[f] || 0) + 1; });
    const bp = ps.filter((p) => p.loc === 'BP').length, sp = ps.filter((p) => p.loc === 'SP').length;
    return '<article class="rhset"><header><h3>' + esc(rhSetor(s)) + '</h3><b class="num">' + ps.length + '</b></header><p class="rhset-l">' + (lids.length ? 'Líder: ' + lids.map((x) => '<button type="button" class="lnk" data-rhid="' + x.id + '">' + esc(rhOrgNome(x)) + '</button>').join(', ') : 'Sem líder') + '</p>' +
      '<p class="rhset-u">' + (bp ? bp + ' Bragança' : '') + (bp && sp ? ' · ' : '') + (sp ? sp + ' São Paulo' : '') + (ps.length - bp - sp ? ' · ' + (ps.length - bp - sp) + ' outra' : '') + ' · ' + [...new Set(ps.map((p) => RH_PA[p.pa] || 'Produção'))].join(' e ') + '</p><ul>' + Object.entries(fns).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => '<li><span>' + esc(f) + '</span><b class="num">' + n + '</b></li>').join('') + '</ul>' +
      '<footer><span>' + rhR(cus) + '/mês</span><i class="rhbar"><i style="width:' + Math.max(2, cus / tot * 100).toFixed(1) + '%"></i></i><small>' + (cus / tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% do custo</small></footer><button type="button" class="rhset-go" data-rh="verSetor:' + esc(s) + '">Ver pessoas ›</button></article>';
  }).join('');
  return '<div class="rhsets">' + cards + '</div>';
}

// Custos
function rhRenderCus(){
  const V = rhV().c, L = rhAtivos().filter((p) => !V.loc || p.loc === V.loc), c = S_().rhCfg;
  let h = rhHead('Custos de pessoal', 'Quanto cada setor custa por mês, com encargos e provisões');
  h += '<div class="cptool">' + rhSeg('cgrp', V.grp, [['setor', 'Por setor'], ['pa', 'Produção x adm'], ['vinc', 'CLT x PJ'], ['loc', 'Por unidade'], ['fn', 'Por função'], ['lid', 'Por líder']]) + rhLocSeg('cloc', V.loc) + '<span class="grow"></span><button type="button" class="btn" data-rh="cfg">Encargos e benefícios</button></div>';
  h += rhKpiGeral(L);
  const key = (p) => V.grp === 'pa' ? RH_PA[p.pa] || 'Produção' : V.grp === 'vinc' ? (p.vinc === 'pj' ? 'PJ' : 'CLT') : V.grp === 'loc' ? RH_LOC[p.loc] || p.loc : V.grp === 'fn' ? rhFn(p.fn) || '—' : V.grp === 'lid' ? (p.lid && rhById(p.lid) ? rhCurto(rhById(p.lid).nome) : 'Sem líder') : rhSetor(p.setor);
  const g = new Map(); L.forEach((p) => { const k = key(p); if (!g.has(k)) g.set(k, []); g.get(k).push(p); });
  const sum = (ps, f) => ps.reduce((a, p) => { const x = rhCusto(p); return a + (x ? f(x) : 0); }, 0);
  const rows = [...g.entries()].map(([k, ps]) => ({ k, ps, rem: sum(ps, (x) => x.rem), enc: sum(ps, (x) => x.enc), prov: sum(ps, (x) => x.prov), ben: sum(ps, (x) => x.ben), tot: sum(ps, (x) => x.total), sem: ps.filter((p) => p.sal == null).length })).sort((a, b) => b.tot - a.tot);
  const T = rows.reduce((a, r) => ({ rem: a.rem + r.rem, enc: a.enc + r.enc, prov: a.prov + r.prov, ben: a.ben + r.ben, tot: a.tot + r.tot, n: a.n + r.ps.length }), { rem: 0, enc: 0, prov: 0, ben: 0, tot: 0, n: 0 }), max = rows.length ? rows[0].tot || 1 : 1;
  const grpN = { setor: 'Setor', pa: 'Produção x adm', vinc: 'Vínculo', loc: 'Unidade', fn: 'Função', lid: 'Líder' }[V.grp];
  h += '<div class="rhcg"><section class="panel"><div class="pscroll"><table class="cpt rhct"><thead><tr><th>' + grpN + '</th><th class="r">Pessoas</th><th class="r">Salário + prêmio</th><th class="r">Encargos</th><th class="r">13º, férias e multa</th>' + (T.ben ? '<th class="r">VA e benefícios</th>' : '') + '<th class="r">Custo por mês</th><th style="width:150px">Composição</th></tr></thead><tbody>' +
    rows.map((r) => '<tr class="clk" data-rh="verGrp:' + esc(V.grp) + '|' + esc(r.k) + '"><td><b>' + esc(r.k) + '</b>' + (r.sem ? '<small class="rhsem">' + r.sem + ' sem salário</small>' : '') + '</td><td class="r num">' + r.ps.length + '</td><td class="r num">' + rhR(r.rem) + '</td><td class="r num">' + rhR(r.enc) + '</td><td class="r num">' + rhR(r.prov) + '</td>' + (T.ben ? '<td class="r num">' + rhR(r.ben) + '</td>' : '') + '<td class="r num"><b>' + rhR(r.tot) + '</b><small class="rhsem">' + (T.tot ? (r.tot / T.tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0) + '%</small></td>' +
      '<td><i class="rhstk" style="width:' + Math.max(4, r.tot / max * 100).toFixed(1) + '%">' + (r.tot ? '<i class="s1" style="width:' + (r.rem / r.tot * 100).toFixed(1) + '%"></i><i class="s2" style="width:' + (r.enc / r.tot * 100).toFixed(1) + '%"></i><i class="s3" style="width:' + (r.prov / r.tot * 100).toFixed(1) + '%"></i>' : '') + '</i></td></tr>').join('') +
    '</tbody><tfoot><tr><td><b>Total</b></td><td class="r num"><b>' + T.n + '</b></td><td class="r num"><b>' + rhR(T.rem) + '</b></td><td class="r num"><b>' + rhR(T.enc) + '</b></td><td class="r num"><b>' + rhR(T.prov) + '</b></td>' + (T.ben ? '<td class="r num"><b>' + rhR(T.ben) + '</b></td>' : '') + '<td class="r num"><b>' + rhR(T.tot) + '</b></td><td></td></tr></tfoot></table></div></section>';
  const lin = (k, v, cls) => '<li' + (cls ? ' class="' + cls + '"' : '') + '><span>' + k + '</span><b class="num">' + rhR(v) + '</b></li>';
  const pa = (f) => sum(L, f);
  h += '<aside class="panel rhcomp"><h2>Para onde vai o dinheiro</h2><p class="cphint">Por mês, ' + (V.loc ? RH_LOC[V.loc] : 'todas as unidades') + '. Regime: ' + esc((RH_REG.find((r) => r[0] === c.regime) || RH_REG[0])[1]) + '.</p><ul class="rhlin">' +
    lin('Produção', sum(L.filter((p) => p.pa !== 'adm'), (x) => x.total)) + lin('Administrativo', sum(L.filter((p) => p.pa === 'adm'), (x) => x.total)) + '<li class="rhsep"></li>' +
    lin('<i class="lg s1"></i>Salários' + (L.some((p) => p.vinc === 'pj') ? ' e notas PJ' : ''), pa((x) => x.sal)) + lin('Prêmios fixos', pa((x) => x.pr)) + (pa((x) => x.guia) ? lin('<i class="lg s2"></i>INSS + CPRB (guia fixa)', pa((x) => x.guia)) : '') + (pa((x) => x.cpp) ? lin('<i class="lg s2"></i>INSS patronal', pa((x) => x.cpp)) : '') + (pa((x) => x.rat) ? lin('RAT', pa((x) => x.rat)) : '') + (pa((x) => x.terc) ? lin('Terceiros (Sistema S etc.)', pa((x) => x.terc)) : '') + lin('FGTS', pa((x) => x.fgts)) +
    lin('<i class="lg s3"></i>13º provisionado', pa((x) => x.d13)) + lin('Férias provisionadas', pa((x) => x.fer)) + (pa((x) => x.multa) ? lin('Multa do FGTS provisionada', pa((x) => x.multa)) : '') + (pa((x) => x.vaF + x.vaC) ? lin('Vale-alimentação', pa((x) => x.vaF + x.vaC)) : '') + (pa((x) => x.vaP) ? lin('Prêmio sem faltas', pa((x) => x.vaP)) : '') + (pa((x) => x.vt) ? lin('Vale-transporte', pa((x) => x.vt)) : '') + (pa((x) => x.outros) ? lin('Outros benefícios', pa((x) => x.outros)) : '') + (pa((x) => x.saude) ? lin('Plano de saúde', pa((x) => x.saude)) : '') + lin('Total por mês', T.tot, 'tot') + lin('Total por ano', T.tot * 12, 'tot') + '</ul></aside></div>';
  return h;
}

// Colaboradores
function rhLista(){
  const F = rhV().p, q = cpNorm(F.q || '');
  return rhAtivos().filter((p) => (!F.loc || p.loc === F.loc) && (!F.setor || (F.setor === '~' ? !p.setor : p.setor === F.setor)) && (!F.sit || p.sit === F.sit || (F.sit === 'semsal' && p.sal == null) || (F.sit === 'pj' && p.vinc === 'pj') || (F.sit === 'clt' && p.vinc !== 'pj')) && (!F.pa || (p.pa || 'prod') === F.pa) && (!F.lid || p.lid === F.lid) && (!q || cpNorm(p.nome + ' ' + (p.apel || '') + ' ' + p.fn + ' ' + p.setor + ' ' + (p.cod || '')).includes(q)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
function rhTabela(){
  const L = rhLista(), tot = rhCustoDe(L);
  return '<section class="panel"><div class="pscroll"><table class="cpt"><thead><tr><th>Colaborador</th><th>Unidade</th><th>Setor</th><th>Líder</th><th>Admissão</th><th class="r">Salário</th><th class="r">Prêmio</th><th class="r">Custo por mês</th><th>Situação</th></tr></thead><tbody>' +
    (L.length ? L.map((p) => { const c = rhCusto(p), l = rhById(p.lid); return '<tr class="clk" data-rhid="' + p.id + '"><td><b>' + esc(rhNome(p.nome)) + '</b>' + (p.vinc === 'pj' ? ' <i class="rhpj">PJ</i>' : '') + '<small class="rhsem">' + (p.apel ? 'Apelido: ' + esc(p.apel) + ' · ' : '') + esc(rhFn(p.fn) || '—') + (p.vinc === 'pj' && rhProv(p).d13 ? ' · paga ' + (rhProv(p).fer ? '13º e férias' : 'só o 13º') : '') + (p.pais && p.pais !== 'Brasil' ? ' · ' + esc(p.pais) : '') + '</small></td><td>' + (RH_LOCC[p.loc] || p.loc) + '</td><td>' + esc(rhSetor(p.setor)) + '<small class="rhsem">' + (RH_PA[p.pa] || 'Produção') + '</small></td><td>' + (l ? esc(rhCurto(l.nome)) : '—') + '</td><td class="num">' + (p.adm ? dmy(p.adm) : '—') + '<small class="rhsem">' + rhCasa(p.adm) + '</small></td><td class="r num">' + (p.sal == null ? '—' : money(+p.sal)) + '</td><td class="r num">' + (p.pr ? money(+p.pr) : '—') + '</td><td class="r num"><b>' + (c ? rhR(c.total) : '—') + '</b></td><td>' + (p.sal == null ? '<span class="rhst warn">Sem salário</span>' : p.sit !== 'ativo' ? '<span class="rhst ' + (p.sit === 'aviso' ? 'bad' : 'warn') + '">' + rhSitNome(p.sit) + (p.ate ? ' até ' + dm(p.ate) : '') + '</span>' : '<span class="rhst">Ativo</span>') + '</td></tr>'; }).join('') : '<tr><td colspan="9" class="cpempty">Ninguém nesse filtro.</td></tr>') +
    '</tbody><tfoot><tr><td colspan="7"><b>' + L.length + (L.length === 1 ? ' pessoa' : ' pessoas') + '</b></td><td class="r num"><b>' + rhR(tot) + '</b></td><td></td></tr></tfoot></table></div></section>';
}
function rhRenderPes(){
  const F = rhV().p, P = rhAtivos(), setores = [...new Set(P.map((p) => p.setor).filter(Boolean))].sort();
  const lids = [...new Set(P.map((p) => p.lid).filter(Boolean))].map(rhById).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
  let h = rhHead('Colaboradores', P.length + ' pessoas · clique numa linha para ver o custo e os dados');
  h += '<div class="cptool rhtool"><div class="gsearch"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="rhQ" value="' + esc(F.q) + '" placeholder="Buscar nome, apelido ou função" autocomplete="off"></div>' +
    selF('rhFLoc', 'Unidade', [['', 'Todas'], ['BP', 'Bragança Paulista'], ['SP', 'São Paulo'], ['TOL', 'Toledo']], F.loc) +
    selF('rhFPa', 'Área', [['', 'Todas'], ['prod', 'Produção'], ['adm', 'Administrativo']], F.pa || '') +
    selF('rhFSet', 'Setor', [['', 'Todos']].concat(setores.map((s) => [s, rhSetor(s)]), [['~', 'Sem setor']]), F.setor) +
    selF('rhFLid', 'Líder', [['', 'Todos']].concat(lids.map((p) => [p.id, rhCurto(p.nome)])), F.lid || '') +
    selF('rhFSit', 'Situação', [['', 'Todas']].concat(RH_SIT, [['semsal', 'Sem salário'], ['clt', 'Só CLT'], ['pj', 'Só PJ']]), F.sit) + '<span class="grow"></span><button type="button" class="btn y" data-rh="novo">+ Novo colaborador</button></div>';
  return h + '<div id="rhBody">' + rhTabela() + '</div>';
}
function renderRh(){
  ensureRh(); rhV();
  const app = document.getElementById('app');
  app.innerHTML = { rho: rhRenderOrg, rhc: rhRenderCus, rhp: rhRenderPes }[view.tela]();
  if (document.getElementById('rhVp')) { rhOrgMede(); const O = rhV().org; if (!O.cam) rhCamIni(); else rhCamAplica(); }
}

// ---------- modal da pessoa ----------
function rhModalP(){
  const novo = view.rhId === 'novo', p0 = novo ? null : rhById(view.rhId); if (!novo && !p0) { view.modal = null; return ''; }
  const V = rhV(), ed = view.rhEd || (view.rhEd = p0 ? { nome: rhNome(p0.nome), apel: p0.apel || '', loc: p0.loc, setor: p0.setor, fn: p0.fn, lid: p0.lid, adm: p0.adm, sal: p0.sal == null ? '' : String(p0.sal).replace('.', ','), pr: p0.pr ? String(p0.pr).replace('.', ',') : '', pais: p0.pais || 'Brasil', sit: p0.sit, ate: p0.ate || '', vinc: p0.vinc || 'clt', pa: p0.pa || 'prod', prov: Object.assign({}, rhProv(p0)) } : { nome: '', apel: '', loc: 'BP', setor: '', fn: '', lid: '', adm: HOJE, sal: '', pr: '', pais: 'Brasil', sit: 'ativo', ate: '', vinc: 'clt', pa: 'prod', prov: null });
  const num = (s) => { const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : null; };
  const p = Object.assign({}, p0 || { fer: [] }, { loc: ed.loc, sal: num(ed.sal), pr: num(ed.pr) || 0, adm: ed.adm, lid: ed.lid, vinc: ed.vinc, prov: ed.prov });
  const c = rhCusto(p), P = rhAtivos();
  const setores = [...new Set(P.map((x) => x.setor).filter(Boolean))].sort(), fns = [...new Set(P.map((x) => x.fn).filter(Boolean))].sort();
  const lids = P.filter((x) => !p0 || x.id !== p0.id).sort((a, b) => a.nome.localeCompare(b.nome));
  const l = rhById(ed.lid);
  let b = '';
  if (!novo) b += pxInfo([['Unidade', RH_LOC[p0.loc] || p0.loc], ['Setor', esc(rhSetor(p0.setor))], ['Área', RH_PA[p0.pa] || 'Produção'], ['Líder', l ? esc(rhCurto(l.nome)) : ''], ['Tempo de casa', rhCasa(p0.adm)], ['Custo por mês', c ? rhR(c.total) : 'sem salário']]);
  if (p0 && p0.sit !== 'ativo') b += '<div class="cpalert ' + (p0.sit === 'aviso' ? 'red' : 'warn') + '"><b>' + rhSitNome(p0.sit) + (p0.ate ? ' até ' + dmy(p0.ate) : '') + '</b>' + (p0.nota ? '<span>' + esc(p0.nota) + '</span>' : '') + '</div>';
    const T = novo ? [['dados', 'Dados']] : [['custo', 'Quanto custa'], ['dados', 'Dados']];
  const tab = novo ? 'dados' : V.tab;
  b += '<div class="pxtabs">' + T.map(([k, n]) => '<button type="button" data-rh="tab:' + k + '" aria-selected="' + (tab === k) + '">' + n + '</button>').join('') + '</div><div class="pxtabb">';
  const lin = (k, v, nota, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + k + (nota ? '<small class="rhsem">' + nota + '</small>' : '') + '</td><td class="r num">' + money(v) + '</td></tr>';
  if (tab === 'custo') {
    const pv = rhProv(p), pj = p.vinc === 'pj', cf = S_().rhCfg, reg = cf.regime;
    const ck = (k, lab, nota, v, on) => '<tr class="' + (on ? '' : 'off') + '"><td><label class="rhck"><input type="checkbox" data-rhprov="' + k + '"' + (on ? ' checked' : '') + '><span>' + lab + '</span></label>' + (nota ? '<small class="rhsem">' + nota + '</small>' : '') + '</td><td class="r num">' + (on ? money(v) : 'não entra') + '</td></tr>';
    b += '<div class="cptool rhvinc"><span class="rhvl">Vínculo</span>' + rhSeg('vinc', ed.vinc, [['clt', 'CLT'], ['pj', 'PJ']]) + '<span class="cphint">' + (pj ? 'PJ: sem INSS patronal, FGTS nem multa. Marque o 13º e as férias se a MRBL paga.' : 'Desmarque o que não quer guardar todo mês.') + '</span></div>';
    if (c && c.fora) b += '<p class="cpvazio">Afastado: fica fora do custo da folha enquanto estiver afastado (o INSS paga). Mude a situação em Dados quando voltar.</p>';
    else if (!c) b += '<p class="cpvazio">Sem ' + (pj ? 'valor mensal' : 'salário') + ' na planilha. Preencha em Dados para ver o custo.</p>';
    else { const fx = c.fer && pv.ter ? c.fer / 4 : 0;
      b += '<table class="cpt cpmini rhcus"><tbody>' + lin(pj ? 'Valor mensal (nota)' : 'Salário', c.sal) + (c.pr ? lin('Prêmio fixo', c.pr, pj ? '' : 'entra na base dos encargos') : '') +
        (pj ? '' : reg === 'guia' ? '<tr class="sec"><td colspan="2">Encargos</td></tr>' + lin('INSS + CPRB (guia fixa)', c.guia, 'parte da guia de ' + money(+cf.guia || 0) + ', proporcional ao salário') + lin('FGTS', c.fgts, (+cf.fgts || 8) + '% sobre salário' + (pv.d13 || pv.fer ? ' e provisões marcadas' : '')) : '<tr class="sec"><td colspan="2">Encargos</td></tr>' + lin('INSS patronal', c.cpp, reg === 'simples' ? 'no Simples vai no DAS' : reg === 'deson' ? '10% (desoneração 2026)' : (+cf.cpp || 20) + '%') + lin('RAT', c.rat, String(+cf.rat || 0).replace('.', ',') + '%') + lin('Terceiros', c.terc, String(+cf.terc || 0).replace('.', ',') + '% (Sistema S, salário-educação, Incra)') + lin('FGTS', c.fgts, (+cf.fgts || 8) + '% sobre salário' + (pv.d13 || pv.fer ? ' e provisões marcadas' : ''))) +
        '<tr class="sec"><td colspan="2">Provisões (guardar todo mês) · marque o que entra</td></tr>' +
        ck('d13', '13º salário', '1/12 por mês', c.d13, pv.d13) +
        ck('fer', 'Férias', '1/12 por mês' + (pv.fer && pv.ter ? ', já com 1/3 de ' + money(fx) : ''), c.fer, pv.fer) +
        (pv.fer ? '<tr class="rhsubck' + (pv.ter ? '' : ' off') + '"><td colspan="2"><label class="rhck"><input type="checkbox" data-rhprov="ter"' + (pv.ter ? ' checked' : '') + '><span>Com o 1/3 de férias</span></label></td></tr>' : '') +
        (pj ? '' : ck('multa', 'Multa do FGTS', '40% do FGTS do mês, se for demitido sem justa causa', c.multa, pv.multa)) +
        (pj ? '' : '<tr class="sec"><td colspan="2">Benefícios (' + (RH_LOCC[p0 ? p0.loc : ed.loc] || '') + ')</td></tr>' +
          (c.vaF ? lin('Vale-alimentação fixo', c.vaF) : '') + (c.vaC ? lin('Vale-alimentação por assiduidade', c.vaC, 'só com ' + (RH_VA_REGRA[p0 ? p0.loc : ed.loc] || RH_VA_REGRA.SP)) : '') + (c.vaP ? lin('Prêmio sem faltas', c.vaP, 'só se não faltar nada no mês') : '') +
          (c.vt ? lin('Vale-transporte', c.vt, c.vtU ? 'VT da unidade dividido entre os CLT dela' : 'menos 6% do salário') : '') + (c.outros ? lin('Outros benefícios', c.outros, 'alimentação, exames, seguro e cursos, rateados entre os CLT') : '') + (c.saude ? lin('Plano de saúde', c.saude) : '')) +
        lin('Custo por mês', c.total, (c.fator).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '× o ' + (pj ? 'valor da nota' : 'salário + prêmio'), 'tot') + lin('Custo por ano', c.total * 12, '', 'tot') + '</tbody></table>' +
        '<p class="cphint">Vínculo e provisões valem só para esta pessoa e ficam gravados ao clicar em Salvar. Encargos e benefícios da empresa mudam em Custos › Encargos e benefícios.</p>'; }
  }
  if (tab === 'dados') {
    const fld = (lab, inner, cls) => '<label class="ffv' + (cls ? ' ' + cls : '') + '"><span>' + lab + '</span>' + inner + '</label>';
    b += '<div class="cpform3">' + fld('Nome *', '<input id="rheNome" value="' + esc(ed.nome) + '">', 'rhw2') + fld('Apelido', '<input id="rheApel" value="' + esc(ed.apel || '') + '" placeholder="Aparece no organograma" autocomplete="off">') + fld('Unidade', '<select id="rheLoc">' + Object.entries(RH_LOC).map(([k, n]) => '<option value="' + k + '"' + (ed.loc === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
      fld('Setor', '<input id="rheSet" data-cbx="rheSetL" data-novo="1" value="' + esc(ed.setor) + '" autocomplete="off"><datalist id="rheSetL">' + setores.map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist>') +
      fld('Função', '<input id="rheFn" data-cbx="rheFnL" data-novo="1" value="' + esc(ed.fn) + '" autocomplete="off"><datalist id="rheFnL">' + fns.map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist>') +
      fld('Líder', '<input id="rheLid" data-cbx="rheLidL" value="' + esc(l ? rhNome(l.nome) : '') + '" autocomplete="off"><datalist id="rheLidL">' + lids.map((x) => '<option value="' + esc(rhNome(x.nome)) + '">').join('') + '</datalist>') +
      fld('Área', '<select id="rhePa">' + Object.entries(RH_PA).map(([k, n]) => '<option value="' + k + '"' + (ed.pa === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') + fld('Vínculo', '<select id="rheVinc"><option value="clt"' + (ed.vinc === 'pj' ? '' : ' selected') + '>CLT</option><option value="pj"' + (ed.vinc === 'pj' ? ' selected' : '') + '>PJ</option></select>') + fld('Admissão', '<input type="date" id="rheAdm" value="' + esc(ed.adm) + '">') + fld(ed.vinc === 'pj' ? 'Valor mensal (R$)' : 'Salário (R$)', '<input id="rheSal" class="r num" inputmode="decimal" value="' + esc(ed.sal) + '">') + fld('Prêmio fixo (R$)', '<input id="rhePr" class="r num" inputmode="decimal" value="' + esc(ed.pr) + '">') +
      fld('Situação', '<select id="rheSit">' + RH_SIT.map(([k, n]) => '<option value="' + k + '"' + (ed.sit === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') + fld('Até', '<input type="date" id="rheAte" value="' + esc(ed.ate) + '">') + '</div>';
  }
  b += '</div>';
  const dir = cpObs('rhObs') + cpTl(p0 ? p0.log : [], 'Sem eventos ainda');
  const foot = (p0 ? (view.rhDel ? '<span class="cpdelq">Excluir de vez?</span><button type="button" class="btn del" data-rh="delSim">Sim, excluir</button><button type="button" class="btn ghost" data-rh="delNao">Não</button>' : '<button type="button" class="btn del ghost" data-rh="del">' + LIXO + 'Excluir</button>') : '') + '<span class="grow"></span><button type="button" class="btn y" data-rh="salvar">' + (novo ? 'Adicionar' : 'Salvar') + '</button>';
  return cpShell('RH · ' + (novo ? 'Novo colaborador' : (RH_LOC[p0.loc] || '')), novo ? 'Novo colaborador' : esc(rhNome(p0.nome)) + '<small class="rhsub">' + (p0.apel ? esc(p0.apel) + ' · ' : '') + esc(rhFn(p0.fn)) + '</small>', '<div class="egrid cpg2"><div>' + b + '</div><div class="cpdir">' + dir + '</div></div>', foot, 'wide cpw rhm');
}
function rhModalCfg(){
  const c = view.rhCfg || (view.rhCfg = Object.assign({}, S_().rhCfg));
  const fld = (lab, inner, nota) => '<label class="ffv"><span>' + lab + '</span>' + inner + (nota ? '<small class="rhsem">' + nota + '</small>' : '') + '</label>';
  const inp = (id, v) => '<input id="' + id + '" class="r num" inputmode="decimal" value="' + esc(String(v).replace('.', ',')) + '">';
  const b = '<p class="cphint">Valem para o cálculo de custo e rescisão de todos. Confirme os percentuais com a contabilidade: RAT depende do CNAE e do FAP, e o regime depende da opção da MRBL.</p>' +
    '<div class="cpform3">' + fld('Regime da contribuição patronal', '<select id="rhcReg">' + RH_REG.map(([k, n]) => '<option value="' + k + '"' + (c.regime === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>', 'Guia fixa: o valor abaixo é dividido entre os CLT proporcional ao salário; INSS patronal, RAT e Terceiros não somam à parte.') +
    fld('Guia mensal (R$)', inp('rhcGuia', c.guia || 0), 'Cobre INSS patronal, RAT, Terceiros e CPRB.') +
    fld('INSS patronal no regime geral (%)', inp('rhcCpp', c.cpp)) + fld('RAT × FAP (%)', inp('rhcRat', c.rat)) + fld('Terceiros (%)', inp('rhcTer', c.terc), 'Indústria: 5,8%') + fld('FGTS (%)', inp('rhcFg', c.fgts)) +
    fld('Provisionar multa do FGTS', '<select id="rhcMul"><option value="1"' + (c.multa ? ' selected' : '') + '>Sim, 40% do FGTS do mês</option><option value="0"' + (c.multa ? '' : ' selected') + '>Não</option></select>') +
    fld('Outros benefícios (R$/mês, total)', inp('rhcOut', c.outros || 0), 'Alimentação, exames, seguro de vida e cursos (média da DRE). Dividido igual entre os CLT.') + fld('% que recebe a parte por assiduidade e o prêmio', inp('rhcPct', c.pctCond == null ? 100 : c.pctCond), '100% = todo mundo recebe (custo máximo).') + fld('Plano de saúde (R$/pessoa/mês)', inp('rhcSa', c.saude)) + '</div>' +
    '<h3 class="rhvah">Vale-alimentação por unidade (R$ por pessoa CLT, por mês)</h3><table class="cpt cpmini rhvat"><thead><tr><th>Unidade</th><th class="r">Fixo</th><th class="r">Por assiduidade</th><th class="r">Prêmio sem faltas</th><th class="r">Total possível</th><th class="r">VT da unidade (R$/mês, total)</th></tr></thead><tbody>' +
    ['BP', 'SP', 'TOL'].map((u) => { const v = (c.vaU || RH_VA_PAD)[u] || RH_VA_PAD[u]; return '<tr><td><b>' + RH_LOC[u] + '</b><small class="rhsem">Assiduidade: ' + RH_VA_REGRA[u] + '</small></td><td class="r">' + inp('rhcVa_' + u + '_f', v.f) + '</td><td class="r">' + inp('rhcVa_' + u + '_c', v.c) + '</td><td class="r">' + inp('rhcVa_' + u + '_p', v.p) + '</td><td class="r num"><b>' + money((+v.f || 0) + (+v.c || 0) + (+v.p || 0)) + '</b></td><td class="r">' + inp('rhcVt_' + u, (c.vtU || {})[u] || 0) + '</td></tr>'; }).join('') +
    '</tbody></table><p class="cphint">Só para CLT (PJ e afastados não recebem). A parte por assiduidade e o prêmio entram pelo % acima; quem passar do limite de atestados/declarações ou faltar deixa de receber naquele mês. O VT da unidade é dividido entre os CLT dela. VA, VT e prêmio não entram na base de INSS e FGTS.</p>';
  return cpShell('RH · Custos', 'Encargos e benefícios', b, '<span class="grow"></span><button type="button" class="btn y" data-rh="cfgOk">Salvar</button>', 'wide rhcfg');
}
function rhModal(){ ensureRh(); return view.modal === 'rh:cfg' ? rhModalCfg() : rhModalP(); }

function rhLerEd(){
  const ed = view.rhEd; if (!ed) return;
  const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
  [['rheVinc', 'vinc'], ['rhePa', 'pa'], ['rheNome', 'nome'], ['rheApel', 'apel'], ['rheLoc', 'loc'], ['rheSet', 'setor'], ['rheFn', 'fn'], ['rheAdm', 'adm'], ['rheSal', 'sal'], ['rhePr', 'pr'], ['rhePais', 'pais'], ['rheSit', 'sit'], ['rheAte', 'ate']].forEach(([id, k]) => { const v = g(id); if (v != null) ed[k] = v; });
  const lv = g('rheLid'); if (lv != null) { const x = rhAtivos().find((p) => cpNorm(rhNome(p.nome)) === cpNorm(lv)); ed.lid = x ? x.id : ''; ed.lidTxt = lv; }
}
function rhAbrir(id){ ensureRh(); Object.assign(view, { rhId: id, rhEd: null, rhDel: false }); rhV().tab = id === 'novo' ? 'dados' : (rhV().tab || 'custo'); view.modal = 'rh:p'; render(); }
function rhSalvar(){
  rhLerEd(); const ed = view.rhEd, obs = (document.getElementById('rhObs') || {}).value || '';
  const num = (s) => { const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : null; };
  if (!String(ed.nome || '').trim()) return cpErr('Preencha o nome.');
  if (ed.lidTxt && !ed.lid) return cpErr('Escolha o líder da lista.');
  const novo = view.rhId === 'novo';
  act(novo ? 'Colaborador adicionado: ' + ed.nome.trim() : 'Colaborador salvo: ' + rhNome(rhById(view.rhId).nome), () => {
    let p = novo ? { id: 'c' + String(Math.max(0, ...S_().colaboradores.map((x) => +String(x.id).replace(/\D/g, '') || 0)) + 1).padStart(3, '0'), log: [] } : rhById(view.rhId);
    const antes = novo ? null : { apel: p.apel || '', sal: p.sal, setor: p.setor, fn: p.fn, lid: p.lid, sit: p.sit, vinc: p.vinc || 'clt', pa: p.pa || 'prod', pv: rhProv(p) };
    Object.assign(p, { nome: ed.nome.trim().toUpperCase(), apel: String(ed.apel || '').trim(), loc: ed.loc, setor: String(ed.setor || '').trim().toUpperCase(), fn: String(ed.fn || '').trim().toUpperCase(), lid: ed.lid, adm: ed.adm, sal: num(ed.sal), pr: num(ed.pr) || 0, pais: ed.pais, sit: ed.sit, ate: ed.sit === 'ativo' ? '' : ed.ate, vinc: ed.vinc || 'clt', pa: ed.pa || 'prod', prov: ed.prov ? Object.assign({}, ed.prov) : null });
    const L = (t) => p.log.push({ em: agora(), por: S_().user, txt: t });
    if (novo) { L('Cadastrado'); S_().colaboradores.push(p); }
    else { if (antes.sal !== p.sal) L('Salário: ' + (antes.sal == null ? '—' : money(+antes.sal)) + ' → ' + (p.sal == null ? '—' : money(p.sal)));
      if (antes.setor !== p.setor) L('Setor: ' + rhSetor(antes.setor) + ' → ' + rhSetor(p.setor));
      if (antes.fn !== p.fn) L('Função: ' + rhFn(antes.fn) + ' → ' + rhFn(p.fn));
      if (antes.lid !== p.lid) { const a = rhById(antes.lid), b2 = rhById(p.lid); L('Líder: ' + (a ? rhCurto(a.nome) : '—') + ' → ' + (b2 ? rhCurto(b2.nome) : '—')); p.sug = false; }
      if (antes.apel !== p.apel) L('Apelido: ' + (antes.apel || '—') + ' → ' + (p.apel || '—'));
      if (antes.pa !== p.pa) L('Área: ' + RH_PA[antes.pa] + ' → ' + RH_PA[p.pa]);
      if (antes.vinc !== p.vinc) L('Vínculo: ' + antes.vinc.toUpperCase() + ' → ' + p.vinc.toUpperCase());
      { const pv = rhProv(p), N = { d13: '13º', fer: 'férias', ter: '1/3 de férias', multa: 'multa do FGTS' }, ch = Object.keys(N).filter((k) => !!antes.pv[k] !== !!pv[k] && !(k === 'multa' && p.vinc === 'pj')).map((k) => (pv[k] ? 'entra ' : 'sai ') + N[k]); if (ch.length) L('Provisões: ' + ch.join(', ')); }
      if (antes.sit !== p.sit) L('Situação: ' + rhSitNome(antes.sit) + ' → ' + rhSitNome(p.sit) + (p.ate ? ' até ' + dmy(p.ate) : '')); }
    if (obs.trim()) L('Obs: ' + obs.trim());
    if (novo) { view.rhId = p.id; view.rhEd = null; rhV().tab = 'custo'; } else view.rhEd = null;
  });
}

document.addEventListener('click', (e) => {
  if (!rhTela() && !/^rh:/.test(view.modal || '')) return;
  if (rhMoveu && e.target.closest && e.target.closest('#rhVp')) { rhMoveu = false; e.stopPropagation(); e.preventDefault(); return; }
  const pid = e.target.closest && e.target.closest('[data-rhid]');
  const el = e.target.closest && e.target.closest('[data-rh]');
  if (!el && pid && !e.target.closest('.modal')) { rhAbrir(pid.dataset.rhid); return; }
  if (!el) return;
  e.stopPropagation();
  const [a, ...r] = el.dataset.rh.split(':'), arg = r.join(':'), V = rhV();
  if (a === 'omodo') { V.org.modo = arg; return render(); }
  if (a === 'oloc') { V.org.loc = arg; V.org.cam = null; return render(); }
  if (a === 'orgReset') return act('Organograma reorganizado', () => { S_().rhOrgPos = {}; });
  if (a === 'zoom') { const vp = document.getElementById('rhVp'); if (!vp) return; if (arg === 'fit') return rhCamFit(); if (arg === '1') return rhZoom(1, vp.clientWidth / 2, vp.clientHeight / 2); const c = V.org.cam; return rhZoom(c.z * (arg === 'in' ? 1.25 : 0.8), vp.clientWidth / 2, vp.clientHeight / 2); }
  if (a === 'eq') { if (V.org.open[arg]) delete V.org.open[arg]; else V.org.open[arg] = 1; return render(); }
  if (a === 'eqall') { if (Object.keys(V.org.open).length) V.org.open = {}; else rhAtivos().forEach((p) => { if (p.lid) V.org.open[p.lid] = 1; }); return render(); }
  if (a === 'verSetor') { Object.assign(V.p, { setor: arg || '~', loc: V.org.loc, sit: '', q: '', lid: '', pa: '' }); view.tela = 'rhp'; return render(); }
  if (a === 'verGrp') { const [g, k] = arg.split('|'); Object.assign(V.p, { setor: '', loc: V.c.loc, sit: '', q: '', lid: '', pa: '' });
    if (g === 'setor') V.p.setor = (rhAtivos().find((p) => rhSetor(p.setor) === k) || {}).setor || '~';
    else if (g === 'loc') V.p.loc = (Object.entries(RH_LOC).find(([, n]) => n === k) || [''])[0];
    else if (g === 'pa') V.p.pa = k === 'Administrativo' ? 'adm' : 'prod';
    else if (g === 'vinc') V.p.sit = k === 'PJ' ? 'pj' : 'clt';
    else if (g === 'lid') V.p.lid = (rhAtivos().find((p) => p.lid && rhById(p.lid) && rhCurto(rhById(p.lid).nome) === k) || {}).lid || '';
    else V.p.q = k;
    view.tela = 'rhp'; return render(); }
  if (a === 'cgrp') { V.c.grp = arg; return render(); }
  if (a === 'cloc') { V.c.loc = arg; return render(); }
  if (a === 'fmodo') { V.f.modo = arg; return render(); }
  if (a === 'floc') { V.f.loc = arg; return render(); }
  if (a === 'novo') return rhAbrir('novo');
  if (a === 'cfg') { view.rhCfg = null; view.modal = 'rh:cfg'; return render(); }
  if (a === 'cfgOk') { const g = (id) => document.getElementById(id).value, n = (id) => { const v = parseFloat(g(id).replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
    return act('Encargos e benefícios do RH salvos', () => { Object.assign(S_().rhCfg, { regime: g('rhcReg'), cpp: n('rhcCpp'), rat: n('rhcRat'), terc: n('rhcTer'), fgts: n('rhcFg'), multa: g('rhcMul') === '1', vt: 0, va: 0, guia: n('rhcGuia'), outros: n('rhcOut'), pctCond: n('rhcPct'), vtU: Object.fromEntries(['BP', 'SP', 'TOL'].map((u) => [u, n('rhcVt_' + u)])), saude: n('rhcSa'), vaU: Object.fromEntries(['BP', 'SP', 'TOL'].map((u) => [u, { f: n('rhcVa_' + u + '_f'), c: n('rhcVa_' + u + '_c'), p: n('rhcVa_' + u + '_p') }])) }); view.modal = null; }); }
  if (a === 'tab') { rhLerEd(); V.tab = arg; return render(); }
  if (a === 'vinc') { rhLerEd(); const ed = view.rhEd; if (ed.vinc !== arg) { ed.vinc = arg; ed.prov = arg === 'pj' ? { d13: false, fer: false, ter: false, multa: false } : { d13: true, fer: true, ter: true, multa: !!S_().rhCfg.multa }; } return render(); }
  if (a === 'rtipo') { rhLerEd(); V.res.tipo = arg; return render(); }
  if (a === 'salvar') return rhSalvar();
  if (a === 'del') { rhLerEd(); view.rhDel = true; return render(); }
  if (a === 'delNao') { view.rhDel = false; return render(); }
  if (a === 'delSim') { const p = rhById(view.rhId); return act('Colaborador excluído: ' + rhNome(p.nome), () => { S_().colaboradores = S_().colaboradores.filter((x) => x.id !== p.id); S_().colaboradores.forEach((x) => { if (x.lid === p.id) x.lid = ''; }); view.modal = null; view.rhDel = false; }); }
}, true);
// ---------- câmera do organograma (arrastar a tela, arrastar caixinhas e zoom) ----------
const RH_ZMIN = 0.15, RH_ZMAX = 2.5;
function rhCamAplica(){ const c = rhV().org.cam, el = document.getElementById('rhOrg'), zp = document.getElementById('rhZp'); if (!el || !c) return; el.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px) scale(' + c.z + ')'; if (zp) zp.textContent = Math.round(c.z * 100) + '%'; }
function rhCamIni(){ // começa em 80%, com a caixa da MRBL centralizada no topo
  const vp = document.getElementById('rhVp'), M = view.rhOrgM; if (!vp || !M || !M.P) return;
  const z = 0.8, e = M.P.emp, cx = e.x + M.w.emp / 2;
  rhV().org.cam = { z, x: vp.clientWidth / 2 - cx * z, y: 64 - e.y * z }; rhCamAplica();
}
function rhCamFit(){ const vp = document.getElementById('rhVp'), M = view.rhOrgM; if (!vp || !M || !M.box) return; const b = M.box, w = b.x1 - b.x0, h = b.y1 - b.y0, z = Math.max(RH_ZMIN, Math.min(1, (vp.clientWidth - 40) / w, (vp.clientHeight - 60) / h)); rhV().org.cam = { z, x: (vp.clientWidth - w * z) / 2 - b.x0 * z, y: Math.max(20, (vp.clientHeight - h * z) / 2) - b.y0 * z }; rhCamAplica(); }
function rhZoom(z, px, py){ const c = rhV().org.cam; if (!c) return; z = Math.max(RH_ZMIN, Math.min(RH_ZMAX, z)); const k = z / c.z; c.x = px - (px - c.x) * k; c.y = py - (py - c.y) * k; c.z = z; rhCamAplica(); }
let rhMoveu = false;
{ let d = null;
  document.addEventListener('pointerdown', (e) => {
    const vp = e.target.closest && e.target.closest('#rhVp'); if (!vp || e.button !== 0 || !rhV().org.cam) return;
    const n = e.target.closest('[data-node]'), id = n ? n.dataset.node : '';
    d = { x: e.clientX, y: e.clientY, cx: rhV().org.cam.x, cy: rhV().org.cam.y, vp, n, id, o: id ? Object.assign({ x: 0, y: 0 }, (S_().rhOrgPos || {})[id]) : null }; rhMoveu = false;
  });
  document.addEventListener('pointermove', (e) => { if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!rhMoveu && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!rhMoveu) { rhMoveu = true; d.vp.classList.add('drag'); if (d.n) d.n.classList.add('mov'); }
    if (d.id) { const z = rhV().org.cam.z; view.rhOrgTmp = { [d.id]: { x: d.o.x + dx / z, y: d.o.y + dy / z } }; rhOrgPosiciona(); }
    else { const c = rhV().org.cam; c.x = d.cx + dx; c.y = d.cy + dy; rhCamAplica(); } });
  const fim = () => { if (!d) return; d.vp.classList.remove('drag'); if (d.n) d.n.classList.remove('mov');
    if (d.id && rhMoveu && view.rhOrgTmp) { (S_().rhOrgPos = S_().rhOrgPos || {})[d.id] = view.rhOrgTmp[d.id]; view.rhOrgTmp = null; save(); rhOrgPosiciona(); const b = document.querySelector('[data-rh="orgReset"]'); if (b) b.hidden = false; }
    d = null; };
  document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
  document.addEventListener('wheel', (e) => { const vp = e.target.closest && e.target.closest('#rhVp'); if (!vp || !rhV().org.cam) return; e.preventDefault(); const r = vp.getBoundingClientRect(), f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)); rhZoom(rhV().org.cam.z * f, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  document.addEventListener('keydown', (e) => { if (!(e.target && e.target.id === 'rhVp')) return; const c = rhV().org.cam, vp = e.target; if (!c) return; const st = 60;
    if (e.key === '+' || e.key === '=') rhZoom(c.z * 1.25, vp.clientWidth / 2, vp.clientHeight / 2); else if (e.key === '-') rhZoom(c.z * 0.8, vp.clientWidth / 2, vp.clientHeight / 2); else if (e.key === '0') rhCamFit();
    else if (e.key === 'ArrowLeft') { c.x += st; rhCamAplica(); } else if (e.key === 'ArrowRight') { c.x -= st; rhCamAplica(); } else if (e.key === 'ArrowUp') { c.y += st; rhCamAplica(); } else if (e.key === 'ArrowDown') { c.y -= st; rhCamAplica(); } else return; e.preventDefault(); });
}
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const n = e.target.closest && e.target.closest('.rhno[data-rhid]'); if (n) { e.preventDefault(); rhAbrir(n.dataset.rhid); } });
document.addEventListener('input', (e) => {
  if (e.target.id === 'rhQ') { rhV().p.q = e.target.value; const b = document.getElementById('rhBody'); if (b) b.innerHTML = rhTabela(); }
});
document.addEventListener('change', (e) => {
  const id = e.target.id, F = rhV().p;
  if (id === 'rhFLoc') { F.loc = e.target.value; return render(); }
  if (id === 'rhFSet') { F.setor = e.target.value; return render(); }
  if (id === 'rhFLid') { F.lid = e.target.value; return render(); }
  if (id === 'rhFPa') { F.pa = e.target.value; return render(); }
  if (id === 'rhFSit') { F.sit = e.target.value; return render(); }
  if (e.target.dataset && e.target.dataset.rhprov) { rhLerEd(); const ed = view.rhEd, k = e.target.dataset.rhprov; ed.prov = Object.assign(rhProv({ vinc: ed.vinc, prov: ed.prov }), { [k]: e.target.checked }); if (k === 'fer' && e.target.checked && ed.vinc !== 'pj') ed.prov.ter = true; return render(); }
  if (id === 'rheVinc') { rhLerEd(); const ed = view.rhEd; ed.prov = ed.vinc === 'pj' ? { d13: false, fer: false, ter: false, multa: false } : { d13: true, fer: true, ter: true, multa: !!S_().rhCfg.multa }; return render(); }
  if (id === 'rhResD') { rhLerEd(); rhV().res.data = e.target.value || HOJE; return render(); }
  if (/^rhe(Sal|Pr|Adm|Lid)$/.test(id) && rhV().tab !== 'dados') { rhLerEd(); return render(); }
});


// ---------- Configurações › RH: importar a planilha "Geral colaboradores" ----------
function cfgRh(){
  ensureRh();
  const P = S_().colaboradores, pj = P.filter((p) => p.vinc === 'pj').length;
  return '<section class="panel" style="padding:16px 18px"><div class="ph" style="padding:0 0 8px"><div><h2>Planilha de colaboradores</h2><small style="color:var(--muted);display:block">' +
    (P.length ? P.length + ' pessoas no cadastro (' + (P.length - pj) + ' CLT, ' + pj + ' PJ).' : 'Ainda não há colaboradores. Importe a planilha "Geral colaboradores".') + '</small></div></div>' +
    '<p class="cphint" style="margin:0 0 12px">Lê a aba com as colunas NOME, LOCAL, ADMISSÃO, FUNÇÃO, SETOR, LIDER, SALÁRIO, PRÊMIO FIXO, OBS, Produção/Adm, CLT ou PJ e TEM 13º/FÉRIAS?. ' +
    'Quem já está no cadastro mantém o apelido e a linha do tempo; o resto passa a vir da planilha. Quem não estiver na planilha sai. Nada é gravado antes de você confirmar a prévia.</p>' +
    '<button type="button" class="btn y" data-rhcfg="imp">Importar planilha (Excel)</button><input type="file" id="rhFile" accept=".xlsx" hidden></section>';
}
async function rhLerExcel(file){
  await ctx.carregarExcel();
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  let erro = null;
  for (const ws of wb.worksheets) {
    const linhas = []; ws.eachRow({ includeEmpty: true }, (row, n) => { linhas[n - 1] = (row.values || []).slice(1).map(ctx.cellVal); });
    try { const r = lerColaboradores(linhas); if (r.pessoas.length) return Object.assign({ aba: ws.name }, r); } catch (e) { erro = erro || e; }
  }
  throw erro || new Error('Não achei colaboradores no arquivo.');
}
function rhImpModal(){
  const I = view.rhImp; if (!I) return '';
  const M = mesclarColaboradores(S_().colaboradores, I.pessoas, agora(), S_().user);
  const nomes = (L) => L.slice(0, 12).map((p) => esc(rhCurto(p.nome))).join(', ') + (L.length > 12 ? ' e mais ' + (L.length - 12) : '');
  const pj = I.pessoas.filter((p) => p.vinc === 'pj').length, adm = I.pessoas.filter((p) => p.pa === 'adm').length;
  const corpo = pxInfo([['Arquivo', esc(I.arquivo)], ['Aba', esc(I.aba)], ['Pessoas', I.pessoas.length], ['CLT · PJ', (I.pessoas.length - pj) + ' · ' + pj], ['Produção · adm', (I.pessoas.length - adm) + ' · ' + adm]]) +
    '<ul class="rhimp"><li><b>' + M.novos.length + ' novos</b>' + (M.novos.length ? '<small>' + nomes(M.novos) + '</small>' : '') + '</li>' +
    '<li><b>' + M.mudados.length + ' com mudança</b><small>salário, setor, líder, vínculo, área ou situação diferentes do cadastro</small></li>' +
    '<li><b>' + M.saem.length + ' saem</b>' + (M.saem.length ? '<small>' + nomes(M.saem) + ' (não estão na planilha)</small>' : '') + '</li></ul>' +
    (I.avisos.length ? '<div class="cpalert warn"><b>Conferir</b><span>' + I.avisos.slice(0, 8).map(esc).join(' · ') + (I.avisos.length > 8 ? ' · e mais ' + (I.avisos.length - 8) : '') + '</span></div>' : '');
  return cpShell('Configurações · RH', 'Importar planilha de colaboradores', corpo, '<span class="grow"></span><button type="button" class="btn ghost" data-modal-close>Cancelar</button><button type="button" class="btn y" data-rhcfg="impOk">Importar ' + I.pessoas.length + ' pessoas</button>', 'wide cpw');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-rhcfg]'); if (!b) return;
  const k = b.dataset.rhcfg;
  if (k === 'imp') { const f = document.getElementById('rhFile'); if (f) { f.value = ''; f.click(); } return; }
  if (k === 'impOk') {
    const I = view.rhImp; if (!I) return;
    const M = mesclarColaboradores(S_().colaboradores, I.pessoas, agora(), S_().user);
    act('Planilha de colaboradores importada: ' + M.ppl.length + ' pessoas (' + M.novos.length + ' novas, ' + M.mudados.length + ' com mudança, ' + M.saem.length + ' saíram)', () => { S_().colaboradores = M.ppl; view.modal = null; view.rhImp = null; });
  }
});
document.addEventListener('change', async (e) => {
  if (!e.target || e.target.id !== 'rhFile') return;
  const file = e.target.files && e.target.files[0]; if (!file) return;
  try { const r = await rhLerExcel(file); view.rhImp = Object.assign({ arquivo: file.name }, r); view.modal = 'rh:imp'; render(); }
  catch (err) { toast('Não consegui ler a planilha: ' + (err && err.message || err), false); }
});

return { telas: RH_TELAS, ehTela: rhTela, render: renderRh, modal: () => view.modal === 'rh:imp' ? rhImpModal() : rhModal(), cfg: cfgRh, ensure: ensureRh };
}
