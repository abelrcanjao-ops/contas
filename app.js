'use strict';
/* Contas — controle de despesas por mês (PWA). Dados salvos só neste aparelho (localStorage). */

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Paletas (mesmas do app Android)
const PAL = {
  apagar: [['#FF6F61', '#D32F2F', '#9F1212'], ['#FFB74D', '#F57C00', '#BF360C'], ['#F48FB1', '#D81B60', '#880E4F'], ['#BA68C8', '#7B1FA2', '#4A148C'], ['#90A4AE', '#546E7A', '#263238']],
  pago: [['#7BD07F', '#2E9B4B', '#1B6B34'], ['#64B5F6', '#1976D2', '#0D47A1'], ['#4DD0E1', '#00897B', '#004D40'], ['#DCE775', '#7CB342', '#33691E'], ['#7986CB', '#3949AB', '#1A237E']],
  botao: [['#F06292', '#AD1457'], ['#BA68C8', '#6A1B9A'], ['#64B5F6', '#1565C0'], ['#FFB74D', '#E65100'], ['#90A4AE', '#37474F']],
};
const TOPO_CLARO = ['#1A237E', '#6A1B9A', '#AD1457'];
const TOPO_ESCURO = ['#0D1245', '#38105A', '#7A0E40'];

/* ---------- utilitários ---------- */

function h(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of filhos.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const parse = (s) => { const n = parseFloat(String(s || '').trim().replace(',', '.')); return isNaN(n) ? 0 : n; };
const fmt = (v) => (v === 0 ? '' : nf.format(v));
const inteiro = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? 0 : n; };
const keyOf = (y, m) => `m_${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;

function aviso(txt) {
  const a = h('div', { class: 'aviso' }, txt);
  document.body.append(a);
  setTimeout(() => a.remove(), 2600);
}

/* ---------- dados ---------- */

const STORE = 'contas.v1';
const PADRAO = { escuro: false, apagar: 0, pago: 0, botao: 0 };
let db = lerDb();

function lerDb() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE));
    if (d && typeof d.meses === 'object') return { meses: d.meses, config: Object.assign({}, PADRAO, d.config) };
  } catch (e) { /* vazio ou indisponível */ }
  return { meses: {}, config: Object.assign({}, PADRAO) };
}

function salvar() {
  try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* modo privado: fica só em memória */ }
}

const hoje = new Date();
let ano = hoje.getFullYear();
let mes = hoje.getMonth();

const listaDe = (k) => db.meses[k] || (db.meses[k] = []);
const itens = () => listaDe(keyOf(ano, mes));
const temComum = (l) => (l || []).some((i) => !i.g);

function novoItem(extra) {
  return Object.assign({ n: '', v: '', p: false }, extra);
}

/* ---------- tema ---------- */

const grad = (cores, dir = '90deg') => `linear-gradient(${dir}, ${cores.join(', ')})`;

function aplicarTema() {
  const c = db.config;
  const r = document.documentElement;
  r.dataset.theme = c.escuro ? 'dark' : 'light';
  r.style.setProperty('--ap', grad(PAL.apagar[c.apagar]));
  r.style.setProperty('--pg', grad(PAL.pago[c.pago]));
  r.style.setProperty('--bt', grad(PAL.botao[c.botao]));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = (c.escuro ? TOPO_ESCURO : TOPO_CLARO)[0];
}

/* ---------- diálogos ---------- */

function modal(montar) {
  const ov = h('div', { class: 'overlay' });
  const box = h('div', { class: 'dlg' });
  ov.append(box);
  const fechar = () => ov.remove();
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(); });
  montar(box, fechar);
  document.body.append(ov);
  // foco direto (dentro do toque do usuário) para o teclado abrir também no iPhone
  const f = box.querySelector('[data-foco]');
  if (f) f.focus();
  return fechar;
}

// Pergunta com várias opções; a última é "cancelar".
function opcoes(msg, rotulos, acoes) {
  modal((box, fechar) => {
    box.append(h('p', null, msg));
    const col = h('div', { class: 'coluna' });
    rotulos.forEach((r, i) => {
      const cancelar = i === rotulos.length - 1;
      col.append(h('button', {
        class: 'btn med ' + (cancelar ? 'cinza' : 'perigo'),
        onclick: () => { fechar(); if (acoes[i]) acoes[i](); },
      }, r));
    });
    box.append(col);
  });
}

function mascaraValor(input, cb) {
  input.addEventListener('input', () => {
    const dig = input.value.replace(/\D/g, '').slice(0, 11);
    const cent = dig ? parseInt(dig, 10) : 0;
    input.value = cent ? nf.format(cent / 100) : '';
    ajustarFonte(input);
    cb(cent ? `${Math.floor(cent / 100)}.${String(cent % 100).padStart(2, '0')}` : '');
  });
}

function ajustarFonte(input) {
  const n = input.value.length;
  input.style.fontSize = n > 12 ? '11px' : n > 10 ? '13px' : n > 9 ? '14px' : '';
}

function novaDespesa() {
  modal((box, fechar) => {
    let valor = '';
    const nome = h('input', { type: 'text', placeholder: 'Ex.: Cartão', autocapitalize: 'sentences', autocomplete: 'off', 'data-foco': '1' });
    const val = h('input', { type: 'tel', inputmode: 'numeric', placeholder: '0,00', autocomplete: 'off' });
    mascaraValor(val, (v) => { valor = v; });
    const parc = h('input', { type: 'tel', inputmode: 'numeric', placeholder: 'Ex.: 12', autocomplete: 'off' });
    const ini = h('input', { type: 'tel', inputmode: 'numeric', placeholder: '1', autocomplete: 'off', value: '1' });
    const grupoIni = h('div', { style: 'display:none' }, h('label', null, 'Começa na parcela'), ini);
    parc.addEventListener('input', () => { grupoIni.style.display = inteiro(parc.value) >= 2 ? 'block' : 'none'; });

    box.append(
      h('h2', null, 'Nova despesa'),
      h('label', null, 'Nome'), nome,
      h('label', null, 'Valor'), val,
      h('label', null, 'Parcelas (opcional)'), parc,
      grupoIni,
      h('div', { class: 'acoes' },
        h('button', { class: 'btn med cinza', onclick: fechar }, 'Cancelar'),
        h('button', {
          class: 'btn med',
          onclick: () => {
            const total = Math.min(inteiro(parc.value), 120);
            let inicio = inteiro(ini.value);
            if (total >= 2) {
              if (inicio < 1) inicio = 1;
              if (inicio > total) { aviso(`A parcela inicial não pode passar de ${total}`); return; }
            }
            criarDespesa(nome.value.trim(), valor, total, inicio);
            fechar();
          },
        }, 'Adicionar')),
    );
  });
}

// Cria a despesa no mês atual; com parcelas, já preenche os meses seguintes
// (a partir da parcela inicial, sem criar meses anteriores).
function criarDespesa(nome, valor, total, inicio) {
  if (total < 2) {
    itens().push(novoItem({ n: nome, v: valor }));
  } else {
    const g = String(Date.now()) + Math.floor(Math.random() * 1e6);
    for (let k = inicio; k <= total; k++) {
      const idx = ano * 12 + mes + (k - inicio);
      listaDe(keyOf(Math.floor(idx / 12), idx % 12)).push(novoItem({ n: nome, v: valor, pc: k, pt: total, g }));
    }
  }
  salvar();
  render();
}

function apagarProximas(it) {
  const atual = keyOf(ano, mes);
  const fora = (x) => x.g === it.g && x.pc >= it.pc;
  for (const k of Object.keys(db.meses)) {
    if (k > atual) db.meses[k] = db.meses[k].filter((x) => !fora(x));
  }
  db.meses[atual] = itens().filter((x) => !fora(x));
  salvar();
  render();
}

function apagar(it) {
  const nm = it.n ? it.n : 'esta despesa';
  const so = () => { db.meses[keyOf(ano, mes)] = itens().filter((x) => x !== it); salvar(); render(); };
  if (it.pt > 0) {
    opcoes(`Apagar "${nm}" (${it.pc}/${it.pt})?`, ['Só esta', 'Esta e as próximas', 'Cancelar'], [so, () => apagarProximas(it), null]);
  } else {
    opcoes(`Apagar "${nm}"?`, ['Apagar', 'Cancelar'], [so, null]);
  }
}

/* ---------- trazer despesas do mês anterior ---------- */

// Mês mais recente, anterior ao atual, com despesas comuns (até 36 meses atrás)
function acharOrigem() {
  let y = ano, m = mes;
  for (let i = 0; i < 36; i++) {
    m--;
    if (m < 0) { m = 11; y--; }
    if (temComum(db.meses[keyOf(y, m)])) return [y, m];
  }
  return null;
}

// Traz só as despesas comuns; as parcelas já são preenchidas automaticamente.
function trazer(y, m) {
  for (const p of db.meses[keyOf(y, m)]) {
    if (!p.g) itens().push(novoItem({ n: p.n, v: p.v }));
  }
  salvar();
  render();
  aviso(`Despesas de ${MESES[m]} trazidas`);
}

/* ---------- tela principal ---------- */

const el = {};

function montar() {
  const app = document.getElementById('app');
  el.mes = h('div', { class: 'mes' });
  el.total = h('div', { class: 'total' });
  el.pago = h('i');
  el.resto = h('i');
  el.lista = h('div', { class: 'lista' });
  el.barra = h('div', { class: 'barra' });

  app.append(
    h('div', { class: 'topo' },
      h('div', { class: 'navwrap' },
        h('div', { class: 'nav' },
          h('button', { 'aria-label': 'Mês anterior', onclick: () => mudarMes(-1) }, '◀'),
          el.mes,
          h('button', { 'aria-label': 'Próximo mês', onclick: () => mudarMes(1) }, '▶')),
        h('button', { class: 'gear', 'aria-label': 'Configurações', onclick: abrirConfig }, '⚙︎')),
      h('div', { class: 'rotulo' }, '💰 TOTAL A PAGAR'),
      el.total,
      h('div', { class: 'progresso' }, el.pago, el.resto)),
    h('div', { class: 'titulos' }, h('div', null, 'Despesa'), h('div', null, 'Valor'), h('div', null, 'Status'), h('div')),
    el.lista,
    el.barra,
  );
}

function mudarMes(d) {
  mes += d;
  if (mes < 0) { mes = 11; ano--; }
  if (mes > 11) { mes = 0; ano++; }
  render();
  el.lista.scrollTop = 0;
}

function atualizarTotal() {
  let aPagar = 0, pago = 0;
  for (const it of itens()) (it.p ? (pago += parse(it.v)) : (aPagar += parse(it.v)));
  el.total.textContent = moeda.format(aPagar).replace(/ /g, ' ');
  const soma = aPagar + pago;
  const f = soma > 0 ? pago / soma : 0;
  el.pago.style.width = `${f * 100}%`;
  el.resto.style.width = `${(1 - f) * 100}%`;
}

function render() {
  el.mes.textContent = `${MESES[mes]} ${ano}`;
  atualizarTotal();
  renderBarra();
  const lista = itens();
  if (!lista.length) {
    el.lista.replaceChildren(h('div', { class: 'vazio' }, '🐷\nNenhuma despesa neste mês.\nToque em “+ Despesa” ou\ntraga as do mês anterior.'));
    return;
  }
  // A PAGAR em cima, PAGO embaixo (ordem de inclusão preservada em cada grupo)
  const ordem = [...lista.filter((i) => !i.p), ...lista.filter((i) => i.p)];
  el.lista.replaceChildren(...ordem.map(linha));
}

function renderBarra() {
  // O botão de trazer despesas só aparece enquanto o mês não tem nenhuma despesa comum
  // (parcelas automáticas não contam)
  const origem = temComum(itens()) ? null : acharOrigem();
  el.barra.replaceChildren(...[
    origem && h('button', { class: 'btn copiar', onclick: () => trazer(origem[0], origem[1]) }, `⟲ Trazer de ${MESES[origem[1]]}`),
    h('button', { class: 'btn', onclick: novaDespesa }, '+ Despesa'),
  ].filter(Boolean));
}

function linha(it) {
  const fixo = it.pt > 0 ? ` (${it.pc}/${it.pt})` : '';

  // nome (editável) + sufixo da parcela (fixo)
  const ed = h('span', { class: 'ed', contenteditable: 'true', spellcheck: 'false', 'data-ph': 'Despesa', autocapitalize: 'sentences', enterkeyhint: 'done' });
  ed.textContent = it.n;
  ed.addEventListener('input', () => {
    if (!ed.textContent) ed.innerHTML = '';
    it.n = ed.textContent.replace(/\s+/g, ' ');
    salvar();
  });
  ed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ed.blur(); } });
  ed.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, t);
  });
  const nome = h('div', { class: 'nome' }, ed, fixo && h('span', { class: 'suf', contenteditable: 'false' }, fixo));
  nome.addEventListener('click', (e) => { if (e.target === nome) ed.focus(); });

  // valor com máscara de reais
  const val = h('input', { class: 'val', inputmode: 'numeric', type: 'tel', autocomplete: 'off', placeholder: '0,00', enterkeyhint: 'done' });
  val.value = fmt(parse(it.v));
  ajustarFonte(val);
  mascaraValor(val, (v) => { it.v = v; salvar(); atualizarTotal(); });
  val.addEventListener('keydown', (e) => { if (e.key === 'Enter') val.blur(); });

  const pill = h('button', {
    class: 'pill',
    onclick: () => { it.p = !it.p; salvar(); render(); },
  }, it.p ? 'PAGO' : 'A PAGAR');

  return h('div', { class: 'linha' + (it.p ? ' pago' : '') },
    nome,
    h('div', null, val),
    h('div', null, pill),
    h('div', null, h('button', { class: 'x', 'aria-label': 'Apagar', onclick: () => apagar(it) }, '✕')));
}

/* ---------- configurações ---------- */

let pagina = null;

function abrirConfig() {
  pagina = h('div', { class: 'pagina' });
  document.body.append(pagina);
  renderConfig();
}

function fecharConfig() {
  if (pagina) pagina.remove();
  pagina = null;
  render();
}

function paleta(titulo, chave) {
  const c = h('div', { class: 'cartao' }, h('div', { class: 'tit' }, titulo));
  const linhaCores = h('div', { class: 'cores' });
  PAL[chave].forEach((cores, i) => {
    linhaCores.append(h('button', {
      class: 'cor' + (db.config[chave] === i ? ' sel' : ''),
      style: `background:${grad(cores, '135deg')}`,
      'aria-label': `Cor ${i + 1}`,
      onclick: () => { db.config[chave] = i; salvar(); aplicarTema(); renderConfig(); },
    }, db.config[chave] === i ? '✓' : ''));
  });
  c.append(linhaCores);
  return c;
}

function renderConfig() {
  const topo = h('div', { class: 'topo' },
    h('div', { class: 'navwrap' },
      h('button', { class: 'gear', 'aria-label': 'Voltar', onclick: fecharConfig }, '◀'),
      h('div', { class: 'tt' }, 'Configurações')));

  const sw = h('button', {
    class: 'sw' + (db.config.escuro ? ' on' : ''), role: 'switch', 'aria-checked': String(db.config.escuro), 'aria-label': 'Tema escuro',
    onclick: () => { db.config.escuro = !db.config.escuro; salvar(); aplicarTema(); renderConfig(); },
  });

  const arquivo = h('input', { type: 'file', accept: '.json,application/json,text/plain', style: 'display:none' });
  arquivo.addEventListener('change', () => { if (arquivo.files[0]) importar(arquivo.files[0]); arquivo.value = ''; });

  pagina.replaceChildren(
    topo,
    h('div', { class: 'cartao' }, h('div', { class: 'linha-sw' }, h('div', { class: 'tit' }, '🌙 Tema escuro'), sw)),
    paleta('🎨 Cor das despesas A PAGAR', 'apagar'),
    paleta('🎨 Cor das despesas PAGO', 'pago'),
    paleta('🎨 Cor do botão + Despesa', 'botao'),
    h('div', { class: 'cartao' },
      h('div', { class: 'tit' }, '💾 Backup'),
      h('div', { class: 'desc' }, 'Exporte suas despesas para um arquivo, ou importe o arquivo gerado pelo app Android ou por esta versão.'),
      h('button', { class: 'btn copiar', onclick: exportar }, 'Exportar dados'),
      h('button', { class: 'btn', onclick: () => arquivo.click() }, 'Importar dados'),
      arquivo),
    h('div', { class: 'cartao', style: 'background:none;box-shadow:none;padding:0' },
      h('button', {
        class: 'btn',
        onclick: () => { db.config = Object.assign({}, PADRAO); salvar(); aplicarTema(); renderConfig(); },
      }, 'Restaurar padrão')),
    h('div', { class: 'fundo-pagina' }),
  );
}

/* ---------- backup ---------- */

function montarBackup() {
  const c = db.config;
  return {
    app: 'contas',
    versao: 1,
    exportadoEm: new Date().toISOString().slice(0, 19),
    meses: db.meses,
    config: { tema_escuro: c.escuro, cor_apagar: c.apagar, cor_pago: c.pago, cor_botao: c.botao },
  };
}

async function exportar() {
  const json = JSON.stringify(montarBackup(), null, 2);
  const nome = `contas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const arq = new File([json], nome, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      await navigator.share({ files: [arq], title: 'Backup Contas' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: nome });
  document.body.append(a);
  a.click();
  a.remove();
}

// Valida e normaliza um arquivo de backup (formato do app Android ou desta versão)
function lerBackup(txt) {
  const o = JSON.parse(txt);
  if (!o || typeof o.meses !== 'object' || Array.isArray(o.meses)) throw new Error('formato');
  const meses = {};
  for (const [k, arr] of Object.entries(o.meses)) {
    if (!/^m_\d{4}-\d{2}$/.test(k) || !Array.isArray(arr)) continue;
    meses[k] = arr.filter((i) => i && typeof i === 'object').map((i) => {
      const it = { n: String(i.n ?? ''), v: String(i.v ?? ''), p: !!i.p };
      if (i.pt > 0) { it.pc = inteiro(i.pc); it.pt = inteiro(i.pt); it.g = String(i.g || ''); }
      return it;
    });
  }
  const c = o.config || {};
  const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  const config = {
    escuro: !!c.tema_escuro,
    apagar: idx(c.cor_apagar, PAL.apagar.length),
    pago: idx(c.cor_pago, PAL.pago.length),
    botao: idx(c.cor_botao, PAL.botao.length),
  };
  return { meses, config };
}

function importar(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    let novo;
    try { novo = lerBackup(String(leitor.result)); } catch (e) { aviso('Arquivo de backup inválido'); return; }
    const total = Object.values(novo.meses).reduce((s, l) => s + l.length, 0);
    const aplicar = () => {
      db = { meses: novo.meses, config: novo.config };
      salvar();
      aplicarTema();
      renderConfig();
      aviso(`Backup importado: ${total} despesas`);
    };
    const existe = Object.values(db.meses).some((l) => l.length);
    if (!existe) aplicar();
    else opcoes(`Importar ${total} despesas e substituir os dados atuais deste aparelho?`, ['Substituir tudo', 'Cancelar'], [aplicar, null]);
  };
  leitor.readAsText(arquivo);
}

/* ---------- início ---------- */

aplicarTema();
montar();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
