// Diretoria: Resultado, Despesas e Carteira (as páginas do Power BI "reuniaoDiretoria"), portadas do protótipo aprovado.
// Fontes: faturamento = base importada da planilha do faturamento (aba FatHistorico, Configurações › Diretoria);
// recebimentos e despesas = Fluxo de Caixa do sistema (dreData) e, para anos fechados, a aba DreHistorico (histAno);
// parcelas a pagar = Parcelamentos + Cheques.
/* eslint-disable */
export const DIR_TELAS = ['dirr', 'dird', 'dirk'];
export const DIR_TITULO = { dirr: 'Resultado', dird: 'Despesas', dirk: 'Carteira' };

// Regras puras (testadas em test/front/diretoria.test.js)
const semAcento = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
// Animale: pelo nome do cliente (Animale ou Seda). Mixed e Le Lis não entram, mesmo sendo da facção Seda.
export const clienteChave = (cli) => { const c = semAcento(cli); return /ANIMALE|SEDA/.test(c) ? 'ANIMALE' : (c || '(SEM CLIENTE)'); };
// sem mês escolhido: só meses fechados; com escolha, entra até o mês corrente
export function periodo(ano, tris, meses, cur){
  const pad = (n) => String(n).padStart(2, '0'), tri = (m) => String(Math.ceil(m / 3));
  const base = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !tris.length || tris.includes(tri(m)));
  const sel = meses.length ? base.filter((m) => meses.includes(String(m))) : base;
  const escolheu = tris.length || meses.length;
  const ms = sel.map((m) => ano + '-' + pad(m)).filter((mk) => escolheu ? mk <= cur : mk < cur);
  return { ms, prev: ms.map((mk) => (ano - 1) + mk.slice(4)) };
}
const CONS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO', 'BRAG', 'SAO PAULO', 'EXTERNO', 'SEDA', 'REALIZADO', 'PREVISAO'];
const pad2 = (n) => String(n).padStart(2, '0');
function dataBR(v){
  if (v instanceof Date) return v.getUTCFullYear() + '-' + pad2(v.getUTCMonth() + 1) + '-' + pad2(v.getUTCDate());
  const t = String(v == null ? '' : v).trim(); if (/^\d{4}-\d\d-\d\d/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return null;
  return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad2(+m[2]) + '-' + pad2(+m[1]);
}
const numPlan = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const t = String(v).replace(/R\$|\s|\u00a0/g, ''); if (!t) return null; const x = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return isFinite(x) ? x : null; };
// Uma aba SEMANAL (linhas já como listas de valores, coluna A = índice 0), com as regras de limpeza do Power BI:
// pula cabeçalho, linhas de previsão e de totais (mês, Bragança, São Paulo, Externo, Seda, Realizado); sem data de faturamento fica de fora.
export function lerSemanal(linhas){
  const rows = []; let semData = 0, ign = 0;
  linhas.forEach((r) => {
    if (!r) return;
    const c = (i) => r[i - 1], tx = (i) => { const v = c(i); return v == null || v instanceof Date ? '' : String(v).trim(); };
    const os = tx(3), cli = tx(4), prod = tx(6);
    if (!os && !cli) return;
    if (semAcento(os) === 'OS') return;
    if (/PREVIS/.test(semAcento(os))) { ign++; return; }
    if (CONS.some((x) => semAcento(tx(9)).includes(x))) { ign++; return; }
    if (!os && !prod) return;
    const data = dataBR(c(12)), qtd = numPlan(c(10)) || 0, valor = numPlan(c(11)) || 0;
    if (!data) { if (qtd || valor) semData++; return; }
    rows.push({ data, os, cli, canal: tx(5), prod, corte: numPlan(c(7)), vUnit: numPlan(c(8)), qtd, valor, nf: tx(13) });
  });
  return { rows, semData, ign };
}

export function criarDiretoria(ctx){
  const { view, render, act, toast, api, esc, money, num, pad, cap, MESES, MES3, mesNome, mAdd, CUR, cellVal, normTxt } = ctx;
  const ANO = +CUR.slice(0, 4);
  let S = ctx.getS();
  const atual = () => { S = ctx.getS(); };
  let FAT = ctx.fat || [], IMP = Array.isArray(ctx.imp) ? ctx.imp : [];
  const dirTela = () => DIR_TELAS.includes(view.tela);
  const DIR_COR = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const DIR_OUTROS = '#A3AAB9';
  const DIR_ANT = '#B9C3E3', DIR_ATU = '#102574';
  const DIR_GRP = [['FORNECEDORES (CMV)', 'Fornecedores (CMV)', 5], ['FRETE', 'Frete', 1.5], ['DESPESAS COM FUNCIONARIOS', 'Funcionários', 33], ['ENCARGOS SOCIAIS', 'Encargos sociais', 6],
    ['DESPESAS COM UTILITARIOS E SERVIÇOS', 'Utilitários e serviços', 1], ['DESPESAS TRIBUTARIAS FEDERAIS', 'Tributos federais e estaduais', 5], ['DESPESAS TRIBUTARIAS MUNICIPAIS', 'Tributos municipais', 0.5],
    ['DESPESAS COM VENDAS E MKT', 'Vendas e marketing', 1], ['DESPESAS ADMINISTRATIVA', 'Administrativa', 5], ['ACESSORIAS', 'Acessórias', 10], ['MANUTENCAO PREDIAL', 'Manutenção predial', 0.5],
    ['PREJUIZOS', 'Prejuízos', 0], ['DESPESAS FINANCEIRAS', 'Financeiras', 5], ['FINANCIAMENTOS', 'Financiamentos', 3], ['PRÓ-LABORE', 'Pró-labore', 5], ['AQUISIÇÕES / INVESTIMENTOS', 'Aquisições / investimentos', 3],
    ['MANUTENÇAO VEICULAR', 'Manutenção veicular', 1.5], ['PROVISAO', 'Provisão', 2], ['ALUGUEL', 'Aluguel', 2.5], ['OUTROS / DIVERSOS', 'Outros / diversos', 0]];
  const dirGNome = (k) => (DIR_GRP.find((g) => g[0] === k) || [k, cap(String(k).toLowerCase())])[1];
  const dirGOrd = (k) => { const i = DIR_GRP.findIndex((g) => g[0] === k); return i < 0 ? 99 : i; };

  const METAS_PADRAO = Object.fromEntries(DIR_GRP.map(([k, , m]) => [k, m]));
  const metas = () => S.dirMetas || METAS_PADRAO;
  const metaFat = () => S.dirMetaFat == null ? 1800000 : +S.dirMetaFat || 0;
  function dirV(){ if (!view.dir) view.dir = { ano: ANO, tris: [], meses: [], clis: [], desp: [], pg: 'cat', gexp: {}, kexp: {} }; return view.dir; }
  const DIR_MES_OPC = MESES.map((m, i) => [String(i + 1), cap(m)]);
  const DIR_TRI_OPC = [['1', '1º trimestre · jan a mar'], ['2', '2º trimestre · abr a jun'], ['3', '3º trimestre · jul a set'], ['4', '4º trimestre · out a dez']];
  const dirTriDe = (m) => String(Math.ceil(+m / 3));
  // meses que o filtro de trimestre deixa escolher
  const dirMesOpc = () => { const V = dirV(); return V.tris.length ? DIR_MES_OPC.filter((o) => V.tris.includes(dirTriDe(o[0]))) : DIR_MES_OPC; };
  // clientes (Seda soma em Animale), do maior faturamento para o menor
  function dirCliOpc(){
    const t = {}, nk = {};
    dirFat(false).forEach((r) => { t[r.k] = (t[r.k] || 0) + r.valor; const c = (nk[r.k] = nk[r.k] || {}); c[r.cli] = (c[r.cli] || 0) + 1; });
    return Object.keys(t).sort((a, b) => t[b] - t[a]).map((k) => [k, k === 'ANIMALE' ? 'ANIMALE (inclui Seda)' : Object.entries(nk[k]).sort((a, b) => b[1] - a[1])[0][0]]);
  }
  function dirMsfDef(key){
    const V = dirV();
    if (key === 'dir:tris') return { get: () => V.tris, set: (a) => { V.tris = a; if (a.length) V.meses = V.meses.filter((m) => a.includes(dirTriDe(m))); }, opts: () => DIR_TRI_OPC };
    if (key === 'dir:meses') return { get: () => V.meses, set: (a) => { V.meses = a; }, opts: dirMesOpc };
    if (key === 'dir:desp') return { get: () => V.desp || [], set: (a) => { V.desp = a; }, opts: () => DIR_GRP.filter((g) => g[0] !== 'OUTROS / DIVERSOS').map((g) => [g[0], g[1]]) };
    if (key === 'dir:clis') return { get: () => V.clis, set: (a) => { V.clis = a; }, opts: dirCliOpc };
    return null;
  }
  // período escolhido (só meses que já começaram) e o mesmo período do ano anterior
  function dirPer(){
    const V = dirV(), ano = V.ano;
    const base = V.tris.length ? Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => V.tris.includes(dirTriDe(m))) : Array.from({ length: 12 }, (_, i) => i + 1);
    const sel = V.meses.length ? base.filter((m) => V.meses.includes(String(m))) : base;
    const escolheu = V.tris.length || V.meses.length;
    // sem escolha: só meses fechados (o mês corrente entra quando for escolhido em Meses)
    const ms = sel.map((m) => ano + '-' + pad(m)).filter((mk) => escolheu ? mk <= CUR : mk < CUR);
    const prev = ms.map((mk) => (ano - 1) + mk.slice(4));
    return { ano, ms, prev, sel: new Set(ms.map((mk) => +mk.slice(5))), lab: dirPerLab(ms), labP: dirPerLab(prev) };
  }
  function dirPerLab(ms){
    if (!ms.length) return '—';
    const seq = ms.every((mk, i) => !i || mAdd(ms[i - 1], 1) === mk);
    const l = (mk) => MES3[+mk.slice(5) - 1] + '/' + mk.slice(2, 4);
    if (ms.length === 1) return l(ms[0]);
    if (seq) return MES3[+ms[0].slice(5) - 1] + (ms[0].slice(0, 4) === ms[ms.length - 1].slice(0, 4) ? '' : '/' + ms[0].slice(2, 4)) + '–' + l(ms[ms.length - 1]);
    return ms.length + ' meses de ' + ms[0].slice(0, 4);
  }
  const dirMk = (mk) => MES3[+mk.slice(5) - 1] + '/' + mk.slice(2, 4);

  // ---------- números ----------
  const dirR = (v) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e6 ? s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi' : a >= 1e3 ? s + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil' : s + 'R$ ' + Math.round(a).toLocaleString('pt-BR'); };
  const dirAx = (v) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e6 ? s + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : a >= 1e3 ? s + Math.round(a / 1e3).toLocaleString('pt-BR') + ' mil' : s + Math.round(a); };
  const dirN = (v) => Math.round(v || 0).toLocaleString('pt-BR');
  const dirNk = (v) => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil' : dirN(v);
  const dirP = (v, d) => v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + '%';
  const dirVar = (a, b) => (b ? (a - b) / Math.abs(b) : null);
  // variação com marcador: só o triângulo leva cor
  const dirDelta = (x, inv) => { if (x == null || !isFinite(x)) return '<span class="ddl">—</span>'; const up = x >= 0, bom = inv ? !up : up; return '<span class="ddl"><i class="' + (Math.abs(x) < 0.0005 ? 'z' : bom ? 'ok' : 'bad') + '">' + (up ? '▲' : '▼') + '</i>' + (up ? '+' : '−') + dirP(Math.abs(x)) + '</span>'; };
  const dirSum = (a) => a.reduce((x, y) => x + (y || 0), 0);

  // ---------- faturamento ----------

  const dirCliK = clienteChave;
  function dirFat(filtrar){
    const rows = dirFatTodas(), cl = dirV().clis;
    return filtrar === false || !cl.length ? rows : rows.filter((r) => cl.includes(r.k));
  }
  // base importada (aba FatHistorico); a tela de Faturamento ainda não está em produção
  let fatCache = null;
  function dirFatTodas(){
    if (!fatCache) fatCache = FAT.filter((r) => /^\d{4}-\d\d-\d\d/.test(String(r.data || ''))).map((r) => ({ data: String(r.data).slice(0, 10), os: String(r.os == null ? '' : r.os), cli: r.cli == null ? '' : String(r.cli), k: dirCliK(r.cli), qtd: +r.qtd || 0, valor: +r.valor || 0 }));
    return fatCache;
  }
  function dirFatMes(rows){ const M = {}; rows.forEach((r) => { const m = M[r.data.slice(0, 7)] = M[r.data.slice(0, 7)] || { valor: 0, qtd: 0 }; m.valor += r.valor; m.qtd += r.qtd; }); return M; }
  // meta de faturamento: o mesmo valor todo mês (Configurações › Diretoria); com filtro de cliente não se aplica
  const dirMeta = () => dirV().clis.length ? 0 : metaFat();

  // ---------- Fluxo de Caixa ----------
  function dirDre(ano){
    if (ano === ctx.DRE_ANO) { const D = ctx.dreData(); return { rec: D.rec, cmv: D.cmv, frete: D.frete, opexCat: D.opexCat }; }
    const H = ctx.histAno(ano); return H && (H.tem || H.opex.some((v) => v)) ? H : null;
  }
  // despesas por grupo e mês: { mk: { grupo: valor } } e subcategorias
  function dirDesp(){
    const G = {}, SUB = {};
    [ANO - 1, ANO].forEach((ano) => {
      const D = dirDre(ano); if (!D) return;
      for (let i = 0; i < 12; i++) {
        const mk = ano + '-' + pad(i + 1), g = G[mk] = {};
        g['FORNECEDORES (CMV)'] = D.cmv[i] || 0; g['FRETE'] = D.frete[i] || 0;
        Object.entries(D.opexCat).forEach(([k, o]) => {
          g[k] = (g[k] || 0) + (o.v[i] || 0);
          const s = SUB[mk + '|' + k] = {}; let soma = 0;
          Object.entries(o.subs || {}).forEach(([sk, v]) => { const x = v[i] || 0; if (Math.abs(x) > 0.004) { s[sk === '—' ? 'Sem subcategoria' : sk] = (s[sk] || 0) + x; soma += x; } });
          const r = (o.v[i] || 0) - soma; if (Math.abs(r) > 1) s['Sem subcategoria'] = (s['Sem subcategoria'] || 0) + r;
        });
      }
    });
    return { G, SUB };
  }
  const dirRec = (mk) => { const D = dirDre(+mk.slice(0, 4)); return D ? (D.rec[+mk.slice(5) - 1] || 0) : 0; };
  const dirDespTot = (Dp, mk) => dirSum(Object.values(Dp.G[mk] || {}));

  // ---------- gráficos (SVG) ----------
  // tooltip: cada alvo tem data-dt="i" e o HTML fica em dirTips[i]
  let dirTips = [];
  const dirTip = (html) => { dirTips.push(html); return dirTips.length - 1; };
  const dirTipRow = (cor, nome, val, forte) => '<div' + (forte ? ' class="tt"' : '') + '>' + (cor ? '<i style="background:' + cor + '"></i>' : '') + esc(nome) + '<span class="num">' + val + '</span></div>';
  function dirEixo(max, min){
    const span = Math.max(1, max - Math.min(0, min || 0)), passos = [1, 2, 2.5, 5];
    let p = 1; const ord = Math.pow(10, Math.floor(Math.log10(span / 5)));
    for (const k of passos) { if (span / (k * ord) <= 6) { p = k * ord; break; } p = 10 * ord; }
    return { passo: p, topo: Math.ceil(max / p) * p || p, base: Math.floor(Math.min(0, min || 0) / p) * p };
  }
  // barras agrupadas por categoria (ex.: mês), com marca de meta opcional
  function dirBarras(o){
    const W = o.w || 1000, H = o.h || 280, L = 58, R = 12, T = 22, B = 30, iw = W - L - R, ih = H - T - B, n = o.cats.length, ns = o.series.length;
    const vals = o.series.flatMap((s) => s.vals.filter((v) => v != null)).concat(o.metaV ? [o.metaV] : []).concat(o.linha ? o.linha.vals.filter((v) => v != null) : []);
    const E = dirEixo(Math.max(1, ...vals), Math.min(0, ...vals)), y = (v) => T + ih - (ih * (v - E.base)) / (E.topo - E.base);
    const cw = iw / n, gap = Math.min(10, cw * 0.18), bw = Math.max(3, (cw - gap * 2 - (ns - 1) * 2) / ns);
    let s = '<div class="fchart dchart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.titulo || '') + '">';
    for (let v = E.base; v <= E.topo + 1e-6; v += E.passo) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl' + (Math.abs(v) < 1e-9 ? ' z' : '') + '"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + (o.ax || dirAx)(v) + '</text>';
    o.cats.forEach((c, i) => {
      const x0 = L + cw * i + gap, fade = o.fade && o.fade(i);
      s += '<g' + (fade ? ' class="dfade"' : '') + '>';
      o.series.forEach((se, j) => {
        const v = se.vals[i]; if (v == null) return; const yy = y(Math.max(0, v)), h = Math.abs(y(v) - y(0)), x = x0 + j * (bw + 2);
        s += '<path d="' + dirBarPath(x, v >= 0 ? yy : y(0), bw, Math.max(h, 0.5), v >= 0) + '" fill="' + (typeof se.cor === 'function' ? se.cor(v, i) : se.cor) + '"/>';
        if (se.rot && v && !fade) s += '<text x="' + (x + bw / 2) + '" y="' + (v >= 0 ? yy - 5 : y(v) + 13) + '" text-anchor="middle" class="dl sm">' + se.rot(v) + '</text>';
      });
      s += '</g><text x="' + (L + cw * i + cw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax">' + esc(c) + '</text>';
      if (o.tips) s += '<rect class="dhit" data-dt="' + dirTip(o.tips(i)) + '" x="' + (L + cw * i) + '" y="' + T + '" width="' + cw + '" height="' + ih + '" fill="transparent"/>';
    });
    if (o.metaV) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.metaV) + '" y2="' + y(o.metaV) + '" class="dmeta"/><text x="' + (W - R) + '" y="' + (y(o.metaV) - 6) + '" text-anchor="end" class="ax b">Meta ' + dirAx(o.metaV) + '</text>';
    if (o.linha) { const pts = o.linha.vals.map((v, i) => v == null ? null : [L + cw * i + cw / 2, y(v)]).filter(Boolean);
      s += '<polyline fill="none" stroke="' + o.linha.cor + '" stroke-width="2" stroke-linejoin="round" points="' + pts.map((p) => p.join(',')).join(' ') + '"/>' + pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + o.linha.cor + '" stroke="#fff" stroke-width="2"/>').join(''); }
    s += '</svg><div class="ftip dtip" hidden></div></div>';
    s += '<div class="flegend">' + o.series.filter((se) => se.nome).map((se) => '<span><i style="background:' + (typeof se.cor === 'function' ? se.corL : se.cor) + '"></i>' + esc(se.nome) + '</span>').join('') + (o.metaV ? '<span><i class="lmeta"></i>Meta de ' + dirR(o.metaV) + ' por mês</span>' : '') + (o.linha ? '<span><i style="background:' + o.linha.cor + '"></i>' + esc(o.linha.nome) + '</span>' : '') + (o.leg || '') + '</div>';
    return s;
  }
  // barra com 4px de raio só na ponta de dados (a base fica reta, presa na linha do zero)
  function dirBarPath(x, y, w, h, up){
    const r = 0;
    if (up) return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
    return 'M' + x + ',' + y + 'V' + (y + h - r) + 'Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h) + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w) + ',' + (y + h - r) + 'V' + y + 'Z';
  }
  // colunas empilhadas: grupos [{nome, cor, vals}]; pct = 100%
  function dirPilha(o){
    const W = o.w || 1000, H = o.h || 300, L = 58, R = 12, T = 14, B = o.sep ? 44 : 30, iw = W - L - R, ih = H - T - B, n = o.cats.length;
    const tot = o.cats.map((_, i) => dirSum(o.grupos.map((g) => Math.max(0, g.vals[i] || 0))));
    const E = o.pct ? { passo: 0.25, topo: 1, base: 0 } : dirEixo(Math.max(1, ...tot), 0), y = (v) => T + ih - (ih * v) / E.topo;
    const cw = iw / n, bw = Math.min(46, cw * 0.72);
    let s = '<div class="fchart dchart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.titulo || '') + '">';
    for (let v = 0; v <= E.topo + 1e-9; v += E.passo) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + (o.pct ? Math.round(v * 100) + '%' : dirAx(v)) + '</text>';
    o.cats.forEach((c, i) => {
      const x = L + cw * i + (cw - bw) / 2; let acc = 0; const t = tot[i] || 0;
      if (t > 0) o.grupos.forEach((g) => {
        const v = Math.max(0, g.vals[i] || 0); if (!v) return; const f = o.pct ? v / t : v;
        const y1 = y(acc + f), h = y(acc) - y1; acc += f;
        s += '<rect x="' + x + '" y="' + (y1 + 1) + '" width="' + bw + '" height="' + Math.max(0, h - 2) + '" fill="' + g.cor + '"/>';
        if (o.pct && h > 15 && bw >= 30) s += '<text x="' + (x + bw / 2) + '" y="' + (y1 + h / 2 + 4) + '" text-anchor="middle" class="dl in">' + Math.round(f * 100) + '%</text>';
      });
      if (!o.pct && t > 0 && o.rot) s += '<text x="' + (x + bw / 2) + '" y="' + (y(t) - 5) + '" text-anchor="middle" class="dl sm">' + o.rot(t) + '</text>';
      s += '<text x="' + (L + cw * i + cw / 2) + '" y="' + (H - (o.sep ? 24 : 10)) + '" text-anchor="middle" class="ax">' + esc(c) + '</text>';
      if (o.tips) s += '<rect class="dhit" data-dt="' + dirTip(o.tips(i)) + '" x="' + (L + cw * i) + '" y="' + T + '" width="' + cw + '" height="' + ih + '" fill="transparent"/>';
    });
    if (o.sep) o.sep.forEach(([i0, i1, lab]) => { s += '<line x1="' + (L + cw * i0 + 4) + '" x2="' + (L + cw * (i1 + 1) - 4) + '" y1="' + (H - 18) + '" y2="' + (H - 18) + '" class="gl"/><text x="' + (L + cw * (i0 + i1 + 1) / 2) + '" y="' + (H - 4) + '" text-anchor="middle" class="ax b">' + lab + '</text>'; });
    s += '</svg><div class="ftip dtip" hidden></div></div>';
    s += '<div class="flegend">' + o.grupos.map((g) => '<span' + (g.key ? ' class="clk" data-dfil="' + esc(g.key) + '" title="Filtrar a tela por ' + esc(g.nome) + '"' : '') + '><i style="background:' + g.cor + '"></i>' + esc(g.nome) + '</span>').join('') + '</div>';
    return s;
  }
  // rosca com legenda em tabela (nome, valor, %)
  function dirRosca(itens, titulo){
    const tot = dirSum(itens.map((x) => Math.max(0, x.v))); if (!tot) return '<p class="pempty">Sem despesas no período.</p>';
    const R = 80, r = 50, c = 90; let a = -Math.PI / 2, s = '<div class="drosca"><svg viewBox="0 0 180 180" role="img" aria-label="' + esc(titulo) + '">';
    itens.forEach((x) => {
      const f = Math.max(0, x.v) / tot; if (!f) return; const a2 = a + f * 2 * Math.PI, big = f > 0.5 ? 1 : 0;
      const p = (rr, an) => (c + rr * Math.cos(an)).toFixed(2) + ',' + (c + rr * Math.sin(an)).toFixed(2);
      s += f >= 0.9999 ? '<circle cx="' + c + '" cy="' + c + '" r="' + (R + r) / 2 + '" fill="none" stroke="' + x.cor + '" stroke-width="' + (R - r) + '"/>' :
        '<path d="M' + p(R, a) + 'A' + R + ',' + R + ' 0 ' + big + ' 1 ' + p(R, a2) + 'L' + p(r, a2) + 'A' + r + ',' + r + ' 0 ' + big + ' 0 ' + p(r, a) + 'Z" fill="' + x.cor + '" stroke="#fff" stroke-width="2"' + (x.key ? ' data-dfil="' + esc(x.key) + '" style="cursor:pointer"' : '') + ' data-dt="' + dirTip('<b>' + esc(x.nome) + '</b>' + dirTipRow(x.cor, 'Valor', dirR(x.v)) + dirTipRow('', 'Participação', dirP(f))) + '" class="dhit2"/>';
      a = a2;
    });
    s += '<text x="90" y="86" text-anchor="middle" class="dl dtot">' + dirAx(tot) + '</text><text x="90" y="104" text-anchor="middle" class="ax">total</text></svg><div class="ftip dtip" hidden></div>';
    s += '<div class="dleg">' + itens.map((x) => '<div class="dli' + (x.key ? ' clk" data-dfil="' + esc(x.key) + '" title="Filtrar a tela por ' + esc(x.nome) : '') + '"><i style="background:' + x.cor + '"></i><span class="n">' + esc(x.nome) + '</span><span class="num">' + dirR(x.v) + '</span><span class="num p">' + dirP(x.v / tot) + '</span></div>').join('') + '</div></div>';
    return s;
  }
  // cor fixa por entidade: a ordem vem do total, e o mesmo nome mantém a cor em todos os gráficos da tela
  function dirTopN(tot, n){
    const ks = Object.keys(tot).filter((k) => tot[k] > 0).sort((a, b) => tot[b] - tot[a]);
    const top = ks.slice(0, ks.length > n ? n - 1 : n), cor = {};
    top.forEach((k, i) => { cor[k] = DIR_COR[i]; });
    return { top, cor, outros: ks.filter((k) => !top.includes(k)) };
  }

  // ---------- cabeçalho comum ----------
  function dirHead(){
    const V = dirV(), P = dirPer(), anos = [ANO - 1, ANO];
    let h = '';  // sem título: a tela escolhida já aparece marcada no menu
    h += '<div class="cptool dtool"><div class="seg dseg" role="tablist" aria-label="Ano">' + anos.map((a) => '<button type="button" role="tab" data-dano="' + a + '" aria-selected="' + (V.ano === a) + '">' + a + '</button>').join('') + '</div>' +
      dirFiltro('dirTris', 'dir:tris', 'Trimestre', V.tris, DIR_TRI_OPC.map((o) => [o[0], o[0] + 'º tri'])) +
      dirFiltro('dirMeses', 'dir:meses', 'Meses', V.meses, DIR_MES_OPC) +
      (view.tela === 'dird' ? dirFiltro('dirDesp', 'dir:desp', 'Despesa', V.desp || [], DIR_GRP.map((g) => [g[0], g[1]])) : '') +
      (['dirr', 'dirk'].includes(view.tela) ? dirFiltro('dirClis', 'dir:clis', 'Cliente', V.clis, dirCliOpc()) : '') +
      '<span class="dper">' + (P.ms.length ? '<b>' + P.lab + '</b> comparado com <b>' + P.labP + '</b>' : 'Nenhum mês escolhido já começou') + (P.ms.includes(CUR) ? ' · ' + mesNome(CUR) + ' ainda em andamento' : V.ano === +CUR.slice(0, 4) && !V.meses.length && !V.tris.length ? ' · ' + mesNome(CUR) + ' (em andamento) só entra se escolhido no filtro' : '') + '</span></div>';
    return h;
  }
  const dirFiltro = (id, key, lab, sel, opc) => '<button type="button" class="cpmbtn msfb' + (sel.length ? ' on' : '') + '" id="' + id + '" data-msf="' + key + '" aria-haspopup="dialog" aria-expanded="false"><span>' + lab + '</span><b>' + esc(dirFTxt(key, sel, opc)) + '</b></button>';
  // texto do botão: até 4 escolhas aparecem pelo nome curto
  function dirFTxt(key, sel, opc){
    if (!sel.length) return 'Todos';
    if (key === 'dir:meses') { const o = DIR_MES_OPC.map((x) => x[0]).filter((v) => sel.includes(v)); return o.length <= 4 ? o.map((v) => MES3[+v - 1]).join(', ') : o.length + ' meses'; }
    if (key === 'dir:tris') return sel.slice().sort().map((v) => v + 'º').join(', ') + ' tri';
    if (sel.length === 1) { const o = opc.find((x) => x[0] === sel[0]); return o ? o[1].replace(' (inclui Seda)', '') : sel[0]; }
    return sel.length + (key === 'dir:desp' ? ' grupos' : ' clientes');
  }
  const dirTit = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/"/g, '&quot;');
  // cabeçalho que ordena: clique alterna maior→menor / menor→maior
  const dirTh = (tab, k, lab, r) => { const o = (dirV().sort || {})[tab] || {}, on = o.k === k; return '<th class="' + (r ? 'r ' : '') + 'dth' + (on ? ' on' : '') + '" aria-sort="' + (on ? (o.d > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="dsort" data-dsort="' + tab + ':' + k + '">' + lab + '<i aria-hidden="true">' + (on ? (o.d > 0 ? '▲' : '▼') : '↕') + '</i></button></th>'; };
  const dirOrd = (tab, def) => Object.assign({ k: def, d: -1 }, (dirV().sort || {})[tab]);
  const dirCmp = (o, get) => (a, b) => { const x = get(a, o.k), y = get(b, o.k); return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : (x || 0) - (y || 0)) * (o.d > 0 ? 1 : -1); };
  const dirKpi = (lab, val, small, cls) => '<div class="kpi' + (cls ? ' ' + cls : '') + '"><span title="' + dirTit(lab) + '">' + lab + '</span><b class="num" title="' + dirTit(val) + '">' + val + '</b><small title="' + dirTit(small) + '">' + (small || '&nbsp;') + '</small></div>';

  // ================= 1. RESULTADO =================
  function dirRenderRes(){
    const P = dirPer(), ano = P.ano, rows = dirFat(), FM = dirFatMes(rows);
    const fv = (ms) => dirSum(ms.map((mk) => (FM[mk] || {}).valor)), fq = (ms) => dirSum(ms.map((mk) => (FM[mk] || {}).qtd));
    const msC = P.ms.filter((mk) => FM[mk]), nMed = (ms) => ms.filter((mk) => FM[mk] && FM[mk].valor).length || 1;
    const fat = fv(P.ms), fatA = fv(P.prev), q = fq(P.ms), qA = fq(P.prev);
    const ult = P.ms.filter((mk) => mk < CUR).pop() || P.ms[P.ms.length - 1], antU = ult ? mAdd(ult, -1) : null;
    const fU = ult ? fv([ult]) : 0, fAU = antU ? fv([antU]) : 0, metaU = dirMeta(), naMeta = metaU ? P.ms.filter((m) => m < CUR && fv([m]) >= metaU).length : 0, fechados = P.ms.filter((m) => m < CUR).length;
    const tk = q ? fat / q : 0, tkA = qA ? fatA / qA : 0;
    let h = dirHead();
    const kF = dirKpi('Faturado · ' + P.lab, dirR(fat), msC.length + (msC.length === 1 ? ' mês' : ' meses') + ' com faturamento') +
      dirKpi('Mesmo período ' + (ano - 1), fatA ? dirR(fatA) : '—', fatA ? P.labP : 'sem dados de ' + (ano - 1)) +
      dirKpi('Variação ano anterior', dirDelta(dirVar(fat, fatA)), fatA ? (fat - fatA >= 0 ? '+' : '−') + dirR(Math.abs(fat - fatA)) : '&nbsp;') +
      dirKpi('Média mensal', dirR(fat / nMed(P.ms)), fatA ? (ano - 1) + ': ' + dirR(fatA / nMed(P.prev)) : '&nbsp;') +
      dirKpi('Meta · ' + (ult ? dirMk(ult) : '—'), ult && metaU ? dirP(fU / metaU, 0) : '—', !metaU ? (dirV().clis.length ? 'a meta é da empresa toda' : 'sem meta') : ult ? dirR(fU) + ' · ' + naMeta + ' de ' + fechados + (fechados === 1 ? ' mês' : ' meses') + ' na meta' : '&nbsp;', 'g') +
      dirKpi('Variação mês anterior', ult ? dirDelta(dirVar(fU, fAU)) : '—', ult ? dirMk(ult) + ' contra ' + dirMk(antU) : '&nbsp;', 'g');
    const kP = dirKpi('Peças faturadas · ' + P.lab, dirN(q), msC.length + (msC.length === 1 ? ' mês' : ' meses') + ' com faturamento') +
      dirKpi('Mesmo período ' + (ano - 1), qA ? dirN(qA) : '—', qA ? P.labP : 'sem dados de ' + (ano - 1)) +
      dirKpi('Variação ano anterior', dirDelta(dirVar(q, qA)), qA ? (q - qA >= 0 ? '+' : '−') + dirN(Math.abs(q - qA)) + ' peças' : '&nbsp;') +
      dirKpi('Média mensal', dirN(q / nMed(P.ms)), qA ? (ano - 1) + ': ' + dirN(qA / nMed(P.prev)) : '&nbsp;') +
      dirKpi('Ticket médio', 'R$ ' + num(tk), 'faturado ÷ peças', 'g') +
      dirKpi('Variação do ticket', dirDelta(dirVar(tk, tkA)), tkA ? (ano - 1) + ': R$ ' + num(tkA) : '&nbsp;', 'g');
    const mk = (a, i) => a + '-' + pad(i + 1), fade = (i) => !P.sel.has(i + 1);
    const vA = MES3.map((_, i) => (FM[mk(ano - 1, i)] || {}).valor || null), vC = MES3.map((_, i) => mk(ano, i) <= CUR ? ((FM[mk(ano, i)] || {}).valor || null) : null);
    const qAv = MES3.map((_, i) => (FM[mk(ano - 1, i)] || {}).qtd || null), qCv = MES3.map((_, i) => mk(ano, i) <= CUR ? ((FM[mk(ano, i)] || {}).qtd || null) : null);
    const metaV = dirMeta();
    const gF = '<section class="panel dpan"><div class="ph"><h2>Faturamento por mês</h2><span class="dsub">' + ano + ' contra ' + (ano - 1) + (metaV ? ' · tracejado = meta de ' + dirR(metaV) + ' por mês' : '') + '</span></div>' +
      dirBarras({ titulo: 'Faturamento por mês', w: 760, h: 300, cats: MES3.map(cap), series: [{ nome: String(ano - 1), cor: DIR_ANT, vals: vA }, { nome: String(ano), cor: DIR_ATU, vals: vC, rot: (v) => v >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : dirAx(v) }], metaV, fade,
        tips: (i) => '<b>' + cap(MESES[i]) + '</b>' + dirTipRow(DIR_ATU, String(ano), vC[i] != null ? dirR(vC[i]) : '—') + dirTipRow(DIR_ANT, String(ano - 1), vA[i] != null ? dirR(vA[i]) : '—') + (metaV ? dirTipRow('', 'Meta', dirR(metaV)) + (vC[i] ? dirTipRow('', 'Atingido', dirP(vC[i] / metaV, 0), true) : '') : '') }) + '</section>';
    const gP = '<section class="panel dpan"><div class="ph"><h2>Peças faturadas por mês</h2><span class="dsub">' + ano + ' contra ' + (ano - 1) + '</span></div>' +
      dirBarras({ titulo: 'Peças por mês', w: 760, h: 300, cats: MES3.map(cap), series: [{ nome: String(ano - 1), cor: '#F2DC9B', vals: qAv }, { nome: String(ano), cor: '#B98A00', vals: qCv, rot: (v) => (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }], fade, ax: (v) => dirNk(v),
        tips: (i) => '<b>' + cap(MESES[i]) + '</b>' + dirTipRow('#B98A00', String(ano), qCv[i] != null ? dirN(qCv[i]) + ' peças' : '—') + dirTipRow('#F2DC9B', String(ano - 1), qAv[i] != null ? dirN(qAv[i]) + ' peças' : '—') + (qCv[i] && vC[i] ? dirTipRow('', 'Ticket', 'R$ ' + num(vC[i] / qCv[i]), true) : '') }) + '</section>';
    h += '<div class="drow2"><section class="panel dblk dres rc"><h3>Faturamento</h3><div class="dbn3">' + kF + '</div></section>' +
      '<section class="panel dblk dres rs"><h3>Produção</h3><div class="dbn3">' + kP + '</div></section></div>';
    h += '<div class="drow2">' + gF + gP + '</div>';
    h += '<p class="dnota">Faturamento em R$ e peças vêm da planilha do faturamento (abas SEMANAL), importada em Configurações › Diretoria. Ticket médio = valor faturado ÷ peças faturadas.</p>';
    return h;
  }

  // ================= 3. DESPESAS =================
  function dirRenderDesp(){
    const P = dirPer(), ano = P.ano, Dp = dirDesp(), V = dirV(), FM = dirFatMes(dirFat(false));
    if (!V.desp) V.desp = [];
    const sel = V.desp, um = sel.length === 1 ? sel[0] : null;
    const somaG = (ms) => { const t = {}; ms.forEach((mk) => Object.entries(Dp.G[mk] || {}).forEach(([k, v]) => { t[k] = (t[k] || 0) + v; })); return t; };
    const somaSub = (ms, k) => { const t = {}; ms.forEach((mk) => Object.entries(Dp.SUB[mk + '|' + k] || {}).forEach(([sk, v]) => { t[sk] = (t[sk] || 0) + v; })); return t; };
    const naSel = (k) => !sel.length || sel.includes(k);
    const GT = somaG(P.ms), GA = somaG(P.prev);
    const fat = dirSum(P.ms.map((mk) => (FM[mk] || {}).valor)), fatA = dirSum(P.prev.map((mk) => (FM[mk] || {}).valor));
    // o que os gráficos mostram: sem filtro ou vários grupos = grupos; um grupo só = as subcategorias dele
    const ent = (mk) => { if (um) return Dp.SUB[mk + '|' + um] || {}; const g = Dp.G[mk] || {}, o = {}; Object.keys(g).forEach((k) => { if (naSel(k)) o[k] = g[k]; }); return o; };
    const somaE = (ms) => { const t = {}; ms.forEach((mk) => Object.entries(ent(mk)).forEach(([k, v]) => { t[k] = (t[k] || 0) + v; })); return t; };
    const nomeE = (k) => um ? k : dirGNome(k);
    const T = somaE(P.ms), TA = somaE(P.prev), tot = dirSum(Object.values(T)), totA = dirSum(Object.values(TA));
    const mks = [], cats = []; [ano - 1, ano].forEach((a) => MES3.forEach((m, i) => { mks.push(a + '-' + pad(i + 1)); cats.push(cap(m)); }));
    const all = {}; mks.forEach((mk) => Object.entries(ent(mk)).forEach(([k, v]) => { all[k] = (all[k] || 0) + v; }));
    const C = dirTopN(all, 8), cor = (k) => C.cor[k] || DIR_OUTROS;
    // cor dos grupos na tabela: sempre a do ranking geral (não muda com o filtro)
    const allG = {}; mks.forEach((mk) => Object.entries(Dp.G[mk] || {}).forEach(([k, v]) => { allG[k] = (allG[k] || 0) + v; }));
    const CG = dirTopN(allG, 8), corG = (k) => CG.cor[k] || DIR_OUTROS;
    const itens = (t) => { const out = C.top.map((k) => ({ nome: nomeE(k), cor: C.cor[k], v: t[k] || 0, key: um ? null : k })); const o = dirSum(C.outros.map((k) => t[k] || 0)); if (o) out.push({ nome: 'Outros', cor: DIR_OUTROS, v: o }); return out.filter((x) => x.v > 0); };
    const od = dirOrd('desp', 'ordem'), gval = (k, c) => c === 'ordem' ? -dirGOrd(k) : c === 'nome' ? dirGNome(k) : c === 'v' ? GT[k] || 0 : c === 'pf' ? (fat ? (GT[k] || 0) / fat : 0) : c === 'meta' ? metas()[k] || 0 : c === 'dif' ? (fat && metas()[k] ? (GT[k] || 0) / fat - metas()[k] / 100 : -9) : c === 'vA' ? GA[k] || 0 : (dirVar(GT[k] || 0, GA[k] || 0) ?? -9);
    const grupos = [...new Set(DIR_GRP.map((g) => g[0]).concat(Object.keys(GT), Object.keys(GA)))].filter((k) => naSel(k) && (k !== 'OUTROS / DIVERSOS' || GT[k] || GA[k])).sort(dirCmp(od, gval));
    const fora = grupos.filter((k) => fat && metas()[k] > 0 && (GT[k] || 0) / fat > metas()[k] / 100);
    const alta = Object.keys(Object.assign({}, T, TA)).map((k) => [k, (T[k] || 0) - (TA[k] || 0)]).sort((a, b) => b[1] - a[1])[0];
    const nomeSel = um ? dirGNome(um) : sel.length ? sel.length + ' grupos' : '';
    let h = dirHead();
    const mt1 = um ? metas()[um] : 0, pf1 = um && fat ? tot / fat : null;
    h += '<div class="kpis dk4">' + dirKpi('Despesas' + (nomeSel ? ' · ' + nomeSel : '') + ' · ' + P.lab, dirR(tot), P.labP + ': ' + dirR(totA) + ' · ' + dirDelta(dirVar(tot, totA), true)) +
      dirKpi((nomeSel || 'Despesas') + ' ÷ faturamento', fat ? dirP(tot / fat) : '—', 'faturado ' + dirR(fat) + (fatA ? ' · ' + (ano - 1) + ': ' + dirP(totA / fatA) : '')) +
      (um ? dirKpi('Meta do grupo', mt1 ? dirP(mt1 / 100) : '—', !mt1 ? 'sem meta' : pf1 == null ? '&nbsp;' : (pf1 > mt1 / 100 ? 'acima da meta em ' : 'abaixo da meta em ') + dirPP(Math.abs(pf1 - mt1 / 100)), pf1 != null && mt1 && pf1 > mt1 / 100 ? 'kd' : '') :
        dirKpi('Grupos fora da meta', String(fora.length), fora.length ? fora.slice(0, 3).map(dirGNome).join(', ') + (fora.length > 3 ? '…' : '') : 'todos dentro da meta', fora.length ? 'kd' : '')) +
      dirKpi(um ? 'Subcategoria que mais subiu' : 'Maior alta', alta && alta[1] > 0 ? esc(nomeE(alta[0])) : '—', alta && alta[1] > 0 ? '+' + dirR(alta[1]) + ' contra ' + P.labP : 'nada subiu', 'g') + '</div>';
    const titR = um ? dirGNome(um) + ' por subcategoria' : 'Distribuição';
    h += '<div class="drow2"><section class="panel dpan"><div class="ph"><h2>' + titR + ' · ' + P.lab + '</h2></div>' + dirRosca(itens(T), titR + ' ' + ano) + '</section>' +
      '<section class="panel dpan"><div class="ph"><h2>' + titR + ' · ' + P.labP + '</h2></div>' + dirRosca(itens(TA), titR + ' ' + (ano - 1)) + '</section></div>';
    const gr = C.top.map((k) => ({ nome: nomeE(k), cor: C.cor[k], key: um ? null : k, vals: mks.map((mk) => ent(mk)[k] || 0) }));
    if (C.outros.length) gr.push({ nome: 'Outros', cor: DIR_OUTROS, vals: mks.map((mk) => dirSum(C.outros.map((k) => ent(mk)[k] || 0))) });
    h += '<section class="panel dpan"><div class="ph"><h2>' + (um ? 'Proporção das subcategorias de ' + dirGNome(um) : 'Proporção das despesas') + ' mês a mês</h2><span class="dsub">' + (ano - 1) + ' e ' + ano + ' · ' + (um ? 'as 7 maiores subcategorias' : 'os 7 maiores grupos') + ' e o resto em Outros' + (um ? '' : ' · clique num grupo para filtrar') + '</span></div>' +
      dirPilha({ titulo: 'Proporção das despesas', pct: true, w: 1600, h: 330, cats, grupos: gr, sep: [[0, 11, String(ano - 1)], [12, 23, String(ano)]],
        tips: (i) => { const t = dirSum(gr.map((g) => g.vals[i])); if (!t) return '<b>' + dirMk(mks[i]) + '</b><div>Sem lançamentos.</div>'; return '<b>' + dirMk(mks[i]) + '</b>' + gr.slice().reverse().map((g) => dirTipRow(g.cor, g.nome, dirP(g.vals[i] / (t || 1)) + ' · ' + dirR(g.vals[i]))).join('') + dirTipRow('', 'Total', dirR(t), true); } }) + '</section>';
    // tabela grupo › subcategoria
    h += '<section class="panel dpan"><div class="ph"><h2>Despesas por grupo · ' + P.lab + '</h2><span class="dsub">Clique no nome para filtrar por esse grupo, na seta para abrir as subcategorias e no título da coluna para ordenar.</span></div>' +
      '<div class="pscroll dfull"><table class="ptab dtab dgt"><colgroup><col class="c-g"><col class="c-v"><col class="c-p"><col class="c-m"><col class="c-r"><col class="c-v"><col class="c-d"></colgroup><thead><tr>' + dirTh('desp', 'nome', 'Grupo') + dirTh('desp', 'v', P.lab, 1) + dirTh('desp', 'pf', '% do fat.', 1) + dirTh('desp', 'meta', 'Meta', 1) + dirTh('desp', 'dif', 'Em relação à meta') + dirTh('desp', 'vA', P.labP, 1) + dirTh('desp', 'var', 'Variação', 1) + '</tr></thead>';
    grupos.forEach((k, gi) => {
      const v = GT[k] || 0, vA = GA[k] || 0, pf = fat ? v / fat : null, mt = metas()[k];
      const s = somaSub(P.ms, k), sA = somaSub(P.prev, k), subs = Object.keys(Object.assign({}, s, sA)), temSub = subs.some((x) => x !== 'Sem subcategoria');
      const aberto = temSub && (k in V.gexp ? !!V.gexp[k] : um === k);
      h += '<tbody class="dgb' + (gi % 2 ? ' zb' : '') + (aberto ? ' ab' : '') + '"><tr class="dgl"><td><div class="dgn">' +
        (temSub ? '<button type="button" class="dexp" data-dgexp="' + esc(k) + '" aria-expanded="' + aberto + '" aria-label="' + (aberto ? 'Fechar' : 'Abrir') + ' subcategorias de ' + esc(dirGNome(k)) + '">' + (aberto ? '▾' : '▸') + '</button>' : '<span class="dexp"></span>') +
        '<i class="dsw" style="background:' + corG(k) + '"></i><button type="button" class="dfl" data-dfil="' + esc(k) + '" title="Filtrar a tela por ' + esc(dirGNome(k)) + '">' + esc(dirGNome(k)) + '</button></div></td>' +
        '<td class="r num">' + money(v) + '</td><td class="r num">' + dirP(pf) + '</td><td class="r num">' + (mt ? dirP(mt / 100) : '—') + '</td><td>' + dirRegua(pf, mt) + '</td><td class="r num">' + money(vA) + '</td><td class="r">' + dirDelta(dirVar(v, vA), true) + '</td></tr>';
      if (aberto) subs.sort((a, b) => (s[b] || 0) - (s[a] || 0)).forEach((sk) => {
        h += '<tr class="dsl"><td><span class="dsn">' + esc(sk) + '</span></td><td class="r num">' + money(s[sk] || 0) + '</td><td class="r num">' + dirP(fat ? (s[sk] || 0) / fat : null) + '</td><td></td><td><span class="dsh">' + dirP(v ? (s[sk] || 0) / v : null) + ' do grupo</span></td><td class="r num">' + money(sA[sk] || 0) + '</td><td class="r">' + dirDelta(dirVar(s[sk] || 0, sA[sk] || 0), true) + '</td></tr>';
      });
      h += '</tbody>';
    });
    const gT = dirSum(grupos.map((k) => GT[k] || 0)), gA = dirSum(grupos.map((k) => GA[k] || 0));
    h += '<tfoot><tr class="totrow"><td>Total' + (sel.length ? ' dos grupos filtrados' : '') + '</td><td class="r num">' + money(gT) + '</td><td class="r num">' + dirP(fat ? gT / fat : null) + '</td><td></td><td></td><td class="r num">' + money(gA) + '</td><td class="r">' + dirDelta(dirVar(gT, gA), true) + '</td></tr></tfoot></table></div></section>';
    return h;
  }
  const dirPP = (x) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' p.p.';
  // régua: barra = % do faturamento; a marca vertical é a meta (fica no meio; a barra cheia é o dobro da meta)
  function dirRegua(pf, mt){
    if (!mt) return '<span class="drg0">sem meta</span>';
    if (pf == null) return '—';
    const m = mt / 100, w = Math.min(1, pf / (2 * m)), acima = pf > m;
    return '<div class="drg' + (acima ? ' acima' : '') + '" title="' + (acima ? 'Acima' : 'Abaixo') + ' da meta em ' + dirPP(Math.abs(pf - m)) + '"><span class="drb"><i style="width:' + (w * 100).toFixed(1) + '%"></i><b></b></span><em>' + (acima ? '+' : '−') + dirPP(Math.abs(pf - m)) + '</em></div>';
  }

  // ================= 4. PARCELAMENTOS FUTUROS =================
  // parcelas em aberto (contas dos parcelamentos) + cheques ainda não pagos
  function dirParcItens(){
    const out = [];
    (S.parcelamentos || []).forEach((p) => { const I = ctx.parcInfo(p); I.abertas.forEach((c) => out.push({ data: c.data, valor: c.valor, p, nome: p.nome + (p.emp && p.emp !== 'MRBL' ? ' · ' + p.emp : ''), cat: p.cat || 'Sem categoria' })); });
    (S.cheques || []).forEach((q) => { const st = ctx.chqSit(q); if (st.k === 'pago' || !q.data) return; out.push({ data: st.c ? st.c.data : q.data, valor: ctx.chqValor(q), chq: q, nome: 'Cheques', cat: 'CHEQUES' }); });
    // vencido e ainda não pago conta no mês atual
    out.forEach((x) => { if (x.data < CUR + '-01') { x.venc = x.data; x.data = CUR + '-01'; } });
    return out;
  }
  function dirParcPainel(){
    const V = dirV(), L = dirParcItens(), ini = CUR, meses = Array.from({ length: 12 }, (_, i) => mAdd(ini, i)), fim = meses[11];
    const porG = V.pg === 'parc' ? (x) => x.nome : (x) => x.cat;
    const nomeG = (k) => V.pg === 'parc' ? k : k === 'CHEQUES' ? 'Cheques' : dirGNome(k);
    const tot = {}; L.filter((x) => x.data.slice(0, 7) >= ini && x.data.slice(0, 7) <= fim).forEach((x) => { tot[porG(x)] = (tot[porG(x)] || 0) + x.valor; });
    const C = dirTopN(tot, 8);
    const val = (k, mk) => dirSum(L.filter((x) => x.data.slice(0, 7) === mk && (k === null ? C.outros.includes(porG(x)) : porG(x) === k)).map((x) => x.valor));
    const gr = C.top.map((k) => ({ nome: nomeG(k), cor: C.cor[k], vals: meses.map((mk) => val(k, mk)) }));
    if (C.outros.length) gr.push({ nome: 'Outros', cor: DIR_OUTROS, vals: meses.map((mk) => val(null, mk)) });
    const depois = {}; L.filter((x) => x.data.slice(0, 7) > fim).forEach((x) => { const a = x.data.slice(0, 4); depois[a] = (depois[a] || 0) + x.valor; });
    let h = '<section class="panel dpan"><div class="ph"><h2>Parcelas a pagar · próximos 12 meses</h2><div class="seg dseg sm" role="tablist" aria-label="Agrupar"><button type="button" role="tab" data-dpg="cat" aria-selected="' + (V.pg !== 'parc') + '">Por categoria</button><button type="button" role="tab" data-dpg="parc" aria-selected="' + (V.pg === 'parc') + '">Por parcelamento</button></div></div>' +
      dirPilha({ titulo: 'Parcelas por mês', cats: meses.map(dirMk), grupos: gr, rot: (v) => dirAx(v), w: 1600, h: 330,
        tips: (i) => { const t = dirSum(gr.map((g) => g.vals[i])); return '<b>' + cap(mesNome(meses[i])) + ' ' + meses[i].slice(0, 4) + '</b>' + gr.slice().reverse().filter((g) => g.vals[i]).map((g) => dirTipRow(g.cor, g.nome, dirR(g.vals[i]))).join('') + dirTipRow('', 'Total do mês', dirR(t), true); } });
    h += '<div class="hint"><span>Depois de ' + dirMk(fim) + ': ' + (Object.keys(depois).length ? Object.keys(depois).sort().map((a) => '<b>' + a + '</b> ' + dirR(depois[a])).join(' · ') : 'nada') + '</span>' + '<span>Inclui os cheques ainda não pagos; o que venceu e não foi pago entra no mês atual.</span>' + '</div></section>';
    return h;
  }
  // ================= 5. CARTEIRA =================
  function dirRenderCart(){
    const P = dirPer(), ano = P.ano, V = dirV(), rows = dirFat();
    const nomeK = {}; rows.forEach((r) => { const c = (nomeK[r.k] = nomeK[r.k] || {}); c[r.cli] = (c[r.cli] || 0) + 1; });
    const nome = (k) => k === 'ANIMALE' ? 'ANIMALE (inclui Seda)' : Object.entries(nomeK[k] || { [k]: 1 }).sort((a, b) => b[1] - a[1])[0][0];
    const doP = (ms) => { const s = new Set(ms); return rows.filter((r) => s.has(r.data.slice(0, 7))); };
    const R = doP(P.ms), RA = doP(P.prev);
    const agg = (L, key) => { const A = {}; L.forEach((r) => { const k = key(r), a = A[k] = A[k] || { valor: 0, qtd: 0, os: new Set() }; a.valor += r.valor; a.qtd += r.qtd; if (r.os) a.os.add(r.os); }); return A; };
    const A = agg(R, (r) => r.k), tv = dirSum(R.map((r) => r.valor));
    const rank = Object.keys(A).sort((a, b) => A[b].valor - A[a].valor);
    let h = dirHead();
    const top1 = rank[0], top3 = dirSum(rank.slice(0, 3).map((k) => A[k].valor));
    h += '<div class="kpis dk4">' + dirKpi('Clientes com faturamento', String(rank.length), P.lab + ' · ' + P.labP + ': ' + Object.keys(agg(RA, (r) => r.k)).length) +
      dirKpi('Maior cliente', top1 ? dirP(A[top1].valor / tv) : '—', top1 ? esc(nome(top1)) + ' · ' + dirR(A[top1].valor) : '') +
      dirKpi('3 maiores clientes', tv ? dirP(top3 / tv) : '—', rank.slice(0, 3).map((k) => esc(nome(k).replace(' (inclui Seda)', ''))).join(', ')) +
      dirKpi('Ticket médio', tv ? 'R$ ' + num(tv / (dirSum(R.map((r) => r.qtd)) || 1)) : '—', 'faturado ÷ peças no período', 'g') + '</div>';
    // proporção mês a mês, os dois anos
    const mks = [], cats = []; [ano - 1, ano].forEach((a) => MES3.forEach((m, i) => { const k = a + '-' + pad(i + 1); mks.push(k); cats.push(cap(m)); }));
    const tot2 = {}; rows.filter((r) => mks.includes(r.data.slice(0, 7))).forEach((r) => { tot2[r.k] = (tot2[r.k] || 0) + r.valor; });
    const C = dirTopN(tot2, 8);
    const porM = {}; rows.forEach((r) => { const mk = r.data.slice(0, 7); const o = porM[mk] = porM[mk] || {}; o[r.k] = (o[r.k] || 0) + r.valor; });
    const gr = C.top.map((k) => ({ nome: nome(k).replace(' (inclui Seda)', ''), cor: C.cor[k], vals: mks.map((mk) => (porM[mk] || {})[k] || 0) }));
    if (C.outros.length) gr.push({ nome: 'Outros', cor: DIR_OUTROS, vals: mks.map((mk) => dirSum(C.outros.map((k) => (porM[mk] || {})[k] || 0))) });
    const i0 = mks.filter((mk) => mk.startsWith(String(ano - 1))).length;
    h += '<section class="panel dpan"><div class="ph"><h2>Proporção do faturamento por cliente</h2><span class="dsub">' + (ano - 1) + ' e ' + ano + ' · os 7 maiores clientes e o resto em Outros</span></div>' +
      dirPilha({ titulo: 'Proporção do faturamento por cliente', pct: true, w: 1600, h: 330, cats, grupos: gr, sep: [[0, i0 - 1, String(ano - 1)], [i0, mks.length - 1, String(ano)]].filter((x) => x[1] >= x[0]),
        tips: (i) => { const t = dirSum(gr.map((g) => g.vals[i])); if (!t) return '<b>' + dirMk(mks[i]) + '</b><div>Sem faturamento.</div>'; return '<b>' + dirMk(mks[i]) + '</b>' + gr.slice().reverse().filter((g) => g.vals[i]).map((g) => dirTipRow(g.cor, g.nome, dirP(g.vals[i] / (t || 1)) + ' · ' + dirR(g.vals[i]))).join('') + dirTipRow('', 'Faturado no mês', dirR(t), true); } }) + '</section>';
    const tabela = (L, lab) => {
      const G = agg(L, (r) => r.k), T = { valor: dirSum(L.map((r) => r.valor)), qtd: dirSum(L.map((r) => r.qtd)), os: new Set(L.map((r) => r.os).filter(Boolean)).size };
      const o = dirOrd('cart', 'valor'), val = (a, k) => k === 'nome' ? a.nome : k === 'os' ? a.os.size : k === 'ticket' ? (a.qtd ? a.valor / a.qtd : 0) : a[k];
      Object.keys(G).forEach((k) => { G[k].nome = nome(k); });
      const ks = Object.keys(G).sort((a, b) => dirCmp(o, val)(G[a], G[b]));
      let t = '<section class="panel dpan"><div class="ph"><h2>Carteira · ' + lab + '</h2><span class="dsub">clique no título da coluna para ordenar</span></div><div class="pscroll"><table class="ptab dtab dcart"><thead><tr>' + dirTh('cart', 'nome', 'Cliente') + dirTh('cart', 'os', 'OS', 1) + dirTh('cart', 'os', '% OS', 1) + dirTh('cart', 'qtd', 'Peças', 1) + dirTh('cart', 'qtd', '% peças', 1) + dirTh('cart', 'valor', 'Faturado', 1) + dirTh('cart', 'valor', '% fat.', 1) + dirTh('cart', 'ticket', 'Ticket', 1) + '</tr></thead><tbody>';
      const linha = (n, a, cls, attr) => '<tr' + (cls ? ' class="' + cls + '"' : '') + (attr || '') + '><td>' + n + '</td><td class="r num">' + dirN(a.os.size) + '</td><td class="r num">' + dirP(a.os.size / (T.os || 1)) + '</td><td class="r num">' + dirN(a.qtd) + '</td><td class="r num">' + dirP(a.qtd / (T.qtd || 1)) + '</td><td class="r num">' + money(a.valor) + '</td><td class="r num">' + dirP(a.valor / (T.valor || 1)) + '</td><td class="r num">' + (a.qtd ? num(a.valor / a.qtd) : '—') + '</td></tr>';
      ks.forEach((k) => {
        const subs = agg(L.filter((r) => r.k === k), (r) => r.cli || '—'), sk = Object.keys(subs), ab = !!V.kexp[k];
        t += linha((sk.length > 1 ? '<span class="dcar">' + (ab ? '▾' : '▸') + '</span>' : '') + (C.cor[k] ? '<i class="dsw" style="background:' + C.cor[k] + '"></i>' : '<i class="dsw" style="background:' + DIR_OUTROS + '"></i>') + esc(nome(k)), G[k], sk.length > 1 ? 'dgrp' : '', sk.length > 1 ? ' data-dkexp="' + esc(k) + '"' : '');
        if (ab && sk.length > 1) { sk.forEach((x) => { subs[x].nome = x; }); sk.sort((a, b) => dirCmp(o, val)(subs[a], subs[b])).forEach((s) => { t += linha(esc(s), subs[s], 'dsubr'); }); }
      });
      t += '<tr class="totrow"><td>Total</td><td class="r num">' + dirN(T.os) + '</td><td class="r num">100%</td><td class="r num">' + dirN(T.qtd) + '</td><td class="r num">100%</td><td class="r num">' + money(T.valor) + '</td><td class="r num">100%</td><td class="r num">' + (T.qtd ? num(T.valor / T.qtd) : '—') + '</td></tr></tbody></table></div></section>';
      return t;
    };
    h += tabela(R, P.lab) + tabela(RA, P.labP);
    return h;
  }


  // ---------- Configurações › Diretoria ----------
  function cfgDir(){
    atual();
    const M = {}; FAT.forEach((r) => { const mk = String(r.data).slice(0, 7); const m = M[mk] = M[mk] || { n: 0, qtd: 0, valor: 0 }; m.n++; m.qtd += +r.qtd || 0; m.valor += +r.valor || 0; });
    const ult = IMP[IMP.length - 1], mt = metas();
    const h25 = dirDre(ANO - 1);
    let h = '<div class="dcfg"><section class="panel"><div class="ph"><div><h2>Base de faturamento</h2><small class="dsub">O painel da Diretoria usa a planilha do faturamento (abas SEMANAL). <b>Mês importado manda:</b> os meses que vierem no arquivo substituem o que estava importado nesses meses; os outros meses ficam como estão.</small></div>' +
      (ctx.admin ? '<button type="button" class="btn sm y" data-dcfg="imp">Importar Excel</button><input type="file" id="dirFile" accept=".xlsx" hidden>' : '<small class="dsub">Só o administrador importa.</small>') + '</div>' +
      (ult ? '<div class="hint" style="border-top:0;padding-top:0"><span>Última importação: ' + esc(ult.arquivo || '') + ' · ' + esc(ult.por || '') + ' · ' + esc(String(ult.em || '').replace('T', ' ')) + '</span></div>' : '') +
      '<div class="pscroll"><table class="ptab dtab"><thead><tr><th>Mês importado</th><th class="r">Linhas</th><th class="r">Peças</th><th class="r">Faturado</th></tr></thead><tbody>' +
      (Object.keys(M).length ? Object.keys(M).sort().map((mk) => '<tr><td>' + cap(mesNome(mk)) + ' ' + mk.slice(0, 4) + '</td><td class="r num">' + M[mk].n + '</td><td class="r num">' + dirN(M[mk].qtd) + '</td><td class="r num">' + money(M[mk].valor) + '</td></tr>').join('') : '<tr><td colspan="4" class="empty">Nada importado ainda. Importe a planilha do faturamento para ver Resultado e Carteira.</td></tr>') + '</tbody></table></div></section>';
    h += '<section class="panel"><div class="ph"><div><h2>Metas</h2><small class="dsub">Meta de faturamento do mês (a mesma para todos os meses) e o limite de cada grupo de despesa em % do faturamento (aparece em Diretoria › Despesas).</small></div><button type="button" class="btn sm pri" data-dcfg="metas">Salvar metas</button></div>' +
      '<div class="dmetas"><label class="ff dmf"><span>Meta de faturamento (R$ por mês, igual em todos os meses)</span><input id="dMetaFat" inputmode="decimal" value="' + num(metaFat()) + '"></label>' +
      '<table class="ptab dtab"><thead><tr><th>Grupo de despesa</th><th class="r">Meta (% do faturamento)</th></tr></thead><tbody>' +
      DIR_GRP.map(([k, n]) => '<tr><td>' + esc(n) + '<small>' + esc(k) + '</small></td><td class="r"><input class="dmi" data-dmeta="' + esc(k) + '" inputmode="decimal" value="' + (mt[k] ? String(mt[k]).replace('.', ',') : '') + '" placeholder="sem meta" aria-label="Meta de ' + esc(n) + '"> %</td></tr>').join('') + '</tbody></table></div></section>';
    h += '<section class="panel"><div class="ph"><div><h2>Histórico do Fluxo de Caixa ' + (ANO - 1) + '</h2><small class="dsub">' + (h25 ? 'Carregado. ' : 'Ainda não importado. ') + 'Recebimentos e despesas de ' + (ANO - 1) + ' (comparação em Diretoria › Despesas) vêm do histórico do Fluxo de Caixa: Fluxo de Caixa › Visão comparativa › Importar.</small></div></div></section></div>';
    return h;
  }
  async function dirLerExcel(file){
    await ctx.carregarExcel();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    const abas = wb.worksheets.filter((w) => /SEMANAL/i.test(w.name));
    if (!abas.length) throw new Error('Não achei nenhuma aba SEMANAL no arquivo.');
    const r = { rows: [], semData: 0, ign: 0, abas: abas.map((w) => w.name) };
    abas.forEach((ws) => {
      const linhas = []; ws.eachRow((row, n) => { linhas[n - 1] = (row.values || []).slice(1).map(cellVal); });
      const x = lerSemanal(linhas); r.rows.push(...x.rows); r.semData += x.semData; r.ign += x.ign;
    });
    // data de faturamento fora do ano anterior e do atual é erro de digitação na planilha (ex.: 1934, 2023): fica de fora
    const ok = (d) => { const a = +d.slice(0, 4); return a >= ANO - 1 && a <= ANO + 1; };
    r.foraAno = r.rows.filter((x) => !ok(x.data)).map((x) => x.data); r.rows = r.rows.filter((x) => ok(x.data));
    return r;
  }
  function dirImpModal(){
    const I = view.dirImp; if (!I) return '';
    const M = {}; I.rows.forEach((r) => { const m = M[r.data.slice(0, 7)] = M[r.data.slice(0, 7)] || { n: 0, qtd: 0, valor: 0 }; m.n++; m.qtd += r.qtd; m.valor += r.valor; });
    const antes = {}; FAT.forEach((r) => { const mk = String(r.data).slice(0, 7); antes[mk] = (antes[mk] || 0) + (+r.valor || 0); });
    return '<div class="modal-bg" data-modal-bg><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" style="width:min(720px,96vw)"><div class="mh"><h2 id="mt">Importar faturamento · ' + esc(I.arquivo) + '</h2><button type="button" class="mx" data-modal-close aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="fbody">' +
      '<p style="margin:0 0 10px;color:var(--muted)">Abas lidas: ' + esc(I.abas.join(', ')) + '. ' + I.rows.length + ' linhas faturadas' + (I.semData ? ', ' + I.semData + ' sem data de faturamento (ficam de fora)' : '') + (I.ign ? ', ' + I.ign + ' de previsão ou total ignoradas' : '') + (I.foraAno && I.foraAno.length ? ', ' + I.foraAno.length + ' com data fora de ' + (ANO - 1) + '–' + (ANO + 1) + ' (ficam de fora; confira na planilha: ' + esc([...new Set(I.foraAno)].sort().slice(0, 6).map((d) => d.split('-').reverse().join('/')).join(', ')) + ')' : '') + '.</p>' +
      '<div class="imp-tab"><table><thead><tr><th>Mês</th><th class="r">Linhas</th><th class="r">Peças</th><th class="r">Faturado no arquivo</th><th class="r">Importado antes</th></tr></thead><tbody>' +
      Object.keys(M).sort().map((mk) => '<tr><td>' + dirMk(mk) + '</td><td class="r num">' + M[mk].n + '</td><td class="r num">' + dirN(M[mk].qtd) + '</td><td class="r num">' + money(M[mk].valor) + '</td><td class="r num">' + (antes[mk] ? money(antes[mk]) : '—') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="fact" style="margin-top:14px"><span class="grow" style="color:var(--muted);font-size:13px">Esses meses passam a vir do arquivo, no lugar do que estava importado. Nada é gravado antes de você confirmar.</span><button type="button" class="btn y" id="dirImpOk"' + (I.rows.length && !I.enviando ? '' : ' disabled') + '>' + (I.enviando ? 'Gravando…' : 'Importar ' + Object.keys(M).length + (Object.keys(M).length === 1 ? ' mês' : ' meses')) + '</button></div></div></div></div>';
  }
  function renderDir(){
    atual(); dirV(); dirTips = [];
    return '<div class="dirw">' + ({ dirr: dirRenderRes, dird: dirRenderDesp, dirk: dirRenderCart }[view.tela])() + '</div>';
  }
  function parcPainel(){ atual(); dirTips = []; return '<div class="dirw">' + dirParcPainel() + '</div>'; }

  // ---------- filtro com busca + selecionar todos ----------
  // Cada filtro guarda uma lista de valores escolhidos; lista vazia = sem filtro.
  let msf = null;
  const msfDef = (key) => dirMsfDef(key);
  function msfHostEl(){
    let h = document.getElementById('msfHost'); if (h) return h;
    h = document.createElement('div'); h.id = 'msfHost'; document.body.appendChild(h);
    const stop = (e) => e.stopPropagation();
    h.addEventListener('click', (e) => { stop(e); const b = e.target.closest('[data-msfa]'); if (!b || !msf) return; const d = msfDef(msf.key); if (!d) return;
      if (b.dataset.msfa === 'limpar') { d.set([]); msf.q = ''; const i = h.querySelector('.msfq'); if (i) { i.value = ''; i.focus(); } render(); msfLista(); }
      if (b.dataset.msfa === 'ok') msfClose(); });
    h.addEventListener('mousedown', stop);
    h.addEventListener('input', (e) => { stop(e); if (e.target.classList.contains('msfq') && msf) { msf.q = e.target.value; msfLista(); } });
    h.addEventListener('change', (e) => { stop(e); const t = e.target; if (!msf || t.type !== 'checkbox') return; const d = msfDef(msf.key); if (!d) return;
      const vis = msfVis(d), sel = new Set(d.get());
      if (t.dataset.msfall != null) vis.forEach((o) => { if (t.checked) sel.add(o[0]); else sel.delete(o[0]); });
      else { const o = vis[+t.dataset.msfi]; if (!o) return; if (t.checked) sel.add(o[0]); else sel.delete(o[0]); }
      const foco = t.dataset.msfall != null ? '[data-msfall]' : '[data-msfi="' + t.dataset.msfi + '"]';
      d.set(d.opts().map((o) => o[0]).filter((v) => sel.has(v))); render(); msfLista(); msfPos(); const n = h.querySelector(foco); if (n) n.focus({ preventScroll: true }); });
    return h;
  }
  const msfVis = (d) => { const q = semAcento(msf.q), all = d.opts(); return q ? all.filter((o) => semAcento(o[1]).includes(q)) : all; };
  function msfLista(){
    if (!msf) return; const h = msfHostEl(), box = h.querySelector('.msfl'), d = msfDef(msf.key), a = document.getElementById(msf.id);
    if (!box || !d || !a) { msfClose(); return; }
    a.setAttribute('aria-expanded', 'true');
    const vis = msfVis(d), sel = new Set(d.get()), nSel = vis.filter((o) => sel.has(o[0])).length, st = box.scrollTop;
    box.innerHTML = vis.length ? '<label class="msfall"><input type="checkbox" data-msfall' + (nSel === vis.length ? ' checked' : '') + '><b>Selecionar todos</b><span class="num">' + vis.length + '</span></label>' +
      vis.slice(0, 500).map((o, i) => '<label><input type="checkbox" data-msfi="' + i + '"' + (sel.has(o[0]) ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>').join('') + (vis.length > 500 ? '<p class="msfmais">Mostrando 500 de ' + vis.length + '. Digite para achar os demais.</p>' : '')
      : '<p class="msfmais">Nada encontrado para “' + esc(msf.q) + '”.</p>';
    box.scrollTop = st;
    const all = box.querySelector('[data-msfall]'); if (all) all.indeterminate = nSel > 0 && nSel < vis.length;
    const n = h.querySelector('.msfn'); if (n) n.textContent = sel.size ? sel.size + (sel.size === 1 ? ' selecionado' : ' selecionados') : 'Sem filtro (mostra tudo)';
    const lp = h.querySelector('[data-msfa="limpar"]'); if (lp) lp.disabled = !sel.size;
  }
  function msfOpen(btn){
    const key = btn.dataset.msf, d = msfDef(key); if (!d) return;
    msf = { key, id: btn.id, q: '' };
    const h = msfHostEl();
    h.innerHTML = '<div class="msf" role="dialog" aria-label="Filtro">' +
      '<div class="msfs"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="text" class="msfq" placeholder="Digite para buscar" autocomplete="off" aria-label="Buscar opção"></div>' +
      '<div class="msfl"></div><div class="msff"><span class="msfn"></span><span class="grow"></span><button type="button" class="lnk" data-msfa="limpar">Limpar</button><button type="button" class="btn sm" data-msfa="ok">Fechar</button></div></div>';
    msfLista();
    // a lista abre com altura para mostrar todas as opções, sem rolagem
    const l = h.querySelector('.msfl'), hh = (d.opts().length + 1) * 34 + 6; l.style.height = Math.min(hh, 460) + 'px'; if (hh <= 460) l.classList.add('dirl');
    msfPos(); const i = h.querySelector('.msfq'); if (i) i.focus({ preventScroll: true });
  }
  // mantém a lista colada no botão, mesmo se a página rolar
  function msfPos(){
    if (!msf) return; const a = document.getElementById(msf.id), p = document.querySelector('#msfHost .msf'); if (!a || !p) { msfClose(); return; }
    const r = a.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) { msfClose(); return; }
    const W = Math.max(280, Math.min(360, r.width)), H = p.offsetHeight || 372, up = window.innerHeight - r.bottom < H + 8 && r.top > window.innerHeight - r.bottom;
    p.style.width = W + 'px'; p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8)) + 'px';
    p.style.top = up ? 'auto' : (r.bottom + 2) + 'px'; p.style.bottom = up ? (window.innerHeight - r.top + 2) + 'px' : 'auto';
  }
  function msfClose(){ if (!msf) return; const a = document.getElementById(msf.id); msf = null; const h = document.getElementById('msfHost'); if (h) h.innerHTML = ''; if (a) a.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('mousedown', (e) => {
    const t = e.target; if (t.closest && t.closest('#msfHost')) return;
    const b = t.closest && t.closest('[data-msf]');
    if (b) { e.preventDefault(); if (msf && msf.id === b.id) msfClose(); else msfOpen(b); return; }
    if (msf) msfClose();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (msf && e.key === 'Escape') { const a = document.getElementById(msf.id); msfClose(); if (a) a.focus(); return; }
    const b = !msf && e.target.closest && e.target.closest('[data-msf]');
    if (b && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); msfOpen(b); }
  }, true);
  window.addEventListener('scroll', () => msfPos(), true);
  window.addEventListener('resize', () => msfPos());

  // ---------- cliques ----------
  document.addEventListener('click', (e) => {
    const t = e.target; if (!t.closest) return;
    atual();
    const an = t.closest('[data-dano]'); if (an && dirTela()) { dirV().ano = +an.dataset.dano; render(); return; }
    const pg = t.closest('[data-dpg]'); if (pg) { dirV().pg = pg.dataset.dpg; render(); return; }
    const so = t.closest('[data-dsort]'); if (so && dirTela()) { const [tab, k] = so.dataset.dsort.split(':'), V = dirV(), S0 = V.sort = V.sort || {}, cur = S0[tab] || {};
      S0[tab] = cur.k === k ? { k, d: -(cur.d || -1) } : { k, d: k === 'nome' ? 1 : -1 }; if (tab === 'desp' && cur.k === k && cur.d === 1 && k !== 'nome') delete S0[tab]; render(); return; }
    const df = t.closest('[data-dfil]'); if (df && view.tela === 'dird') { const V = dirV(), k = df.dataset.dfil; V.desp = (V.desp || []).length === 1 && V.desp[0] === k ? [] : [k]; render(); return; }
    const ge = t.closest('[data-dgexp]'); if (ge && dirTela()) { const V = dirV(), k = ge.dataset.dgexp; V.gexp[k] = ge.getAttribute('aria-expanded') !== 'true'; render(); return; }
    const ke = t.closest('[data-dkexp]'); if (ke && dirTela()) { const V = dirV(), k = ke.dataset.dkexp; V.kexp[k] = !V.kexp[k]; render(); return; }
    const dc = t.closest('[data-dcfg]');
    if (dc && dc.dataset.dcfg === 'imp') { const f = document.getElementById('dirFile'); if (f) f.click(); return; }
    if (dc && dc.dataset.dcfg === 'metas') {
      const nv = (s) => { const x = parseFloat(String(s || '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(x) ? x : null; };
      const mf = nv(document.getElementById('dMetaFat').value); if (mf == null || mf < 0) { toast('A meta de faturamento não está certa.', false); return; }
      const ms = {}; document.querySelectorAll('[data-dmeta]').forEach((i) => { const x = parseFloat(String(i.value || '').replace(',', '.')); ms[i.dataset.dmeta] = isFinite(x) && x > 0 ? x : 0; });
      act('Metas da Diretoria salvas.', () => { const s = ctx.getS(); s.dirMetaFat = mf; s.dirMetas = ms; }); return;
    }
    if (t.id === 'dirImpOk') {
      const I = view.dirImp; if (!I || I.enviando) return;
      const meses = new Set(I.rows.map((r) => r.data.slice(0, 7)));
      I.enviando = true; render();
      api.chamar('faturamento.importar', { arquivo: I.arquivo, linhas: I.rows }).then(() => {
        FAT = FAT.filter((r) => !meses.has(String(r.data).slice(0, 7))).concat(I.rows); fatCache = null;
        IMP = IMP.concat([{ em: ctx.agora(), por: S.user, arquivo: I.arquivo, meses: [...meses].sort() }]);
        view.modal = null; view.dirImp = null; render(); toast('Faturamento importado: ' + meses.size + (meses.size === 1 ? ' mês' : ' meses') + ' de ' + I.arquivo + '.', false);
      }).catch((err) => { I.enviando = false; render(); toast((err && err.message) || 'Não foi possível gravar a importação.', false); });
    }
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'dirFile') return;
    const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
    try { const r = await dirLerExcel(file); view.dirImp = Object.assign({ arquivo: file.name }, r); view.modal = 'dir:imp'; render(); }
    catch (err) { console.error(err); toast(err && err.message ? err.message : 'Não consegui ler o arquivo.', false); }
  });
  // tooltip dos gráficos
  document.addEventListener('mousemove', (e) => {
    const hit = e.target.closest && e.target.closest('[data-dt]'), box = e.target.closest && e.target.closest('.dchart, .drosca');
    document.querySelectorAll('.dtip').forEach((tp) => { if (!box || !box.contains(tp)) tp.hidden = true; });
    if (!hit || !box) return; const tip = box.querySelector('.dtip'); if (!tip) return;
    tip.innerHTML = dirTips[+hit.dataset.dt] || ''; tip.hidden = false;
    const r = box.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 12; if (x + w > r.width) x = e.clientX - r.left - w - 14; if (y + hh > r.height) y = Math.max(0, r.height - hh);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  return { telas: DIR_TELAS, ehTela: dirTela, render: renderDir, cfg: cfgDir, modal: dirImpModal, parcPainel };
}
