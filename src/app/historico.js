// Leitura da aba consolidada de um ano fechado (ex.: "DRE 2025_CONS" da planilha DRE) para a aba DreHistorico.
// Recebe a aba como matriz de valores (linha a linha, coluna A = rótulo, uma coluna por mês) e devolve
// as linhas { mes, tipo, cat, sub, valor } que o Fluxo de Caixa usa na visão comparativa.
// Nenhum dado fica no código: o arquivo é lido no navegador de quem importa e vai direto para a planilha do sistema.

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9()]/g, '');
const r2 = (v) => Math.round(v * 100) / 100;

// Número de célula: aceita número, "R$ 1.234,56", "-R$ 9.114,72", "R$ -", "-" e vazio.
export function numBR(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (/^#/.test(s)) return 0; // #REF! e afins
  const neg = /^-|^\(|-\s*R\$/.test(s);
  const d = s.replace(/[^0-9,.]/g, '');
  if (!/[0-9]/.test(d)) return 0;
  const n = parseFloat(d.includes(',') ? d.replace(/\./g, '').replace(',', '.') : d);
  return isFinite(n) ? (neg ? -n : n) : 0;
}

// listas: { categoria: [subcategorias] } do sistema, para usar os mesmos nomes de 2026.
export function lerFluxoConsolidado(rows, ano, listas) {
  const avisos = [];
  const hi = rows.findIndex((r) => r && r.some((c) => norm(c) === 'JANEIRO'));
  if (hi < 0) throw new Error('Não achei a linha com os meses (JANEIRO a DEZEMBRO).');
  const c0 = rows[hi].findIndex((c) => norm(c) === 'JANEIRO');
  for (let m = 0; m < 12; m++) if (norm(rows[hi][c0 + m]) !== MESES[m]) throw new Error('Os meses não estão em ordem a partir de JANEIRO.');
  const lin = rows.slice(hi + 1).filter((r) => r && norm(r[0])).map((r) => ({ lab: String(r[0]).trim(), n: norm(r[0]), v: MESES.map((_, m) => numBR(r[c0 + m])) }));
  const acha = (f) => lin.find((l) => f(l.n));
  const rec = acha((n) => n === 'TOTALDERECEBIMENTOS'), cmv = acha((n) => n.includes('FORNECEDORESCMV')), frete = acha((n) => n === 'FRETE');
  const fat = acha((n) => n.startsWith('FATURAMENTO')), opT = acha((n) => n === 'DESPESASOPERACIONAIS'), luc = acha((n) => n === 'LUCROLIQUIDO'), sal = acha((n) => n === 'SALDOINICIAL');
  if (!rec || !opT) throw new Error('Não achei as linhas TOTAL DE RECEBIMENTOS e DESPESAS OPERACIONAIS.');

  // categorias do sistema (menos CMV e frete, que têm linha própria)
  const cats = Object.keys(listas).filter((c) => c !== 'FORNECEDORES (CMV)' && c !== 'FRETE');
  const porN = {}; cats.forEach((c) => { porN[norm(c)] = c; });
  const catDe = (n) => porN[n] || porN[n.replace('EESTADUAIS', '')] || porN[n.replace(/S$/, '')] || (n === 'OUTROSDIVERSOS' ? 'OUTROS / DIVERSOS' : null);
  // nomes antigos de subcategoria que mudaram no sistema
  const APELIDOS = { SEGUROVIDA: 'SEGURO DE VIDA', TRANFERENCIA: 'TRANSFERENCIA', OLEODIESELGASOLINAGAS: 'COMBUSTÍVEL', PECASMOBRAIPVALICENCIAMENTO: 'MANUTENÇÃO / PEÇAS DE VEÍCULOS', MATERIAISPCONSTRUCAOEFERRAMENTASMO: 'MATERIAIS P/ CONSTRUÇÃO E FERRAMENTAS' };
  const subDe = (cat, lab) => { const n = norm(APELIDOS[norm(lab)] || lab).replace(/\(OX\)/g, '(OF)'); const s = (listas[cat] || []).find((x) => norm(x) === n || norm(x) === n.replace(/S$/, '') || norm(x).replace(/S$/, '') === n); return s || lab.toUpperCase(); };

  // resumo: categorias logo depois de PONTO DE EQUILIBRIO (ou do lucro), até uma categoria se repetir (começa o detalhe)
  let i = lin.findIndex((l) => l.n === 'PONTODEEQUILIBRIO');
  if (i < 0) i = lin.findIndex((l) => l.n.startsWith('RESULTADOFINAL'));
  const resumo = {}; let det = lin.length;
  for (let j = i + 1; j < lin.length; j++) { const c = catDe(lin[j].n); if (!c) continue; if (resumo[c]) { det = j; break; } resumo[c] = lin[j].v; }
  // detalhe: cabeçalho de categoria seguido das subcategorias
  const subs = {}; let cur = null;
  for (let j = det; j < lin.length; j++) {
    const l = lin[j], c = catDe(l.n);
    if (c && c !== cur) { cur = c; subs[c] = subs[c] || {}; if (!resumo[c]) resumo[c] = l.v; continue; }
    if (!cur) continue;
    const s = subDe(cur, l.lab); const a = subs[cur][s] = subs[cur][s] || MESES.map(() => 0); l.v.forEach((v, m) => { a[m] += v; });
  }

  const linhas = [], mk = (m) => ano + '-' + String(m + 1).padStart(2, '0');
  const push = (m, tipo, cat, sub, v) => { if (Math.abs(v) >= 0.005) linhas.push({ mes: mk(m), tipo, cat, sub, valor: r2(v) }); };
  let ajustes = 0, fora = 0;
  const meses = MESES.map((_, m) => {
    push(m, 'rec', 'TOTAL DE RECEBIMENTOS', '', rec.v[m]);
    if (fat) push(m, 'fat', 'FATURAMENTO', '', fat.v[m]);
    if (sal) push(m, 'saldo', 'SALDO INICIAL', '', sal.v[m]);
    if (cmv) push(m, 'cmv', 'FORNECEDORES (CMV)', 'FORNECEDORES', cmv.v[m]);
    if (frete) push(m, 'frete', 'FRETE', 'FRETE', frete.v[m]);
    let op = 0;
    Object.keys(resumo).forEach((c) => {
      const tot = resumo[c][m], ss = subs[c] || {}, soma = Object.keys(ss).reduce((t, s) => t + ss[s][m], 0);
      // o total da categoria no resumo é o que vale (é ele que soma as despesas operacionais)
      if (Math.abs(tot) < 0.005 && Math.abs(soma) >= 0.005) { fora++; op += 0; return; } // categoria zerada no resumo: o detalhe não entrou no total
      Object.keys(ss).forEach((s) => push(m, 'opex', c, s, ss[s][m]));
      if (Math.abs(tot - soma) >= 0.01) { push(m, 'opex', c, '(sem subcategoria)', tot - soma); ajustes++; }
      op += tot;
    });
    const o = { rec: rec.v[m], fat: fat ? fat.v[m] : 0, cmv: cmv ? cmv.v[m] : 0, frete: frete ? frete.v[m] : 0, opex: op, opexPlanilha: opT.v[m] };
    o.lucro = o.rec - o.cmv - o.frete - o.opex; o.lucroPlanilha = luc ? luc.v[m] : null;
    if (Math.abs(o.opex - o.opexPlanilha) > 1) avisos.push(MESES[m].toLowerCase() + ': as categorias somam ' + r2(o.opex) + ' e a linha DESPESAS OPERACIONAIS diz ' + r2(o.opexPlanilha) + '.');
    return o;
  });
  if (fora) avisos.push(fora + (fora === 1 ? ' caso' : ' casos') + ' de subcategoria com valor numa categoria zerada no resumo: ficou de fora, como na planilha.');
  if (ajustes) avisos.push(ajustes + ' casos em que as subcategorias não somam o total da categoria; a diferença entrou como "(sem subcategoria)".');
  return { ano, linhas, meses, avisos, categorias: Object.keys(resumo) };
}
