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
const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = (v) => moedaFmt.format(v).replace(/ /g, ' ');
const parse = (s) => { const n = parseFloat(String(s || '').trim().replace(',', '.')); return isNaN(n) ? 0 : n; };
const fmt = (v) => (v === 0 ? '' : nf.format(v));
const inteiro = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? 0 : n; };
const keyOf = (y, m) => `m_${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
const canonico = (c) => (c === 0 ? '' : `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`);

// Interpreta o texto digitado como reais: "963" = 963,00; "963,5" = 963,50; "1.200" = 1200,00
function centavosDe(t) {
  t = String(t).trim();
  const idx = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  let inteira = t, dec = '';
  if (idx >= 0) {
    const depois = t.slice(idx + 1).replace(/\D/g, '');
    if (depois.length <= 2) { inteira = t.slice(0, idx); dec = depois; }
  }
  const ds = inteira.replace(/\D/g, '').slice(0, 9);
  return (ds ? parseInt(ds, 10) : 0) * 100 + parseInt(dec.padEnd(2, '0').slice(0, 2), 10);
}

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
const novoItem = (extra) => Object.assign({ n: '', v: '', p: false }, extra);
const porValor = (x, y) => parse(y.v) - parse(x.v); // do mais caro para o mais barato (sort é estável)

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
        class: 'btn grande ' + (cancelar ? 'cinza' : 'perigo'),
        onclick: () => { fechar(); if (acoes[i]) acoes[i](); },
      }, r));
    });
    box.append(col);
  });
}

/* ---------- criar, editar e apagar despesas ---------- */

// Formulário de despesa: nova (editar == undefined) ou edição de uma existente.
function formulario(editar) {
  const edicao = !!editar;
  modal((box, fechar) => {
    const nome = h('input', { type: 'text', placeholder: 'Ex.: Cartão', autocapitalize: 'words', autocomplete: 'off', 'data-foco': '1' });
    const valor = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Ex.: 963,50', autocomplete: 'off' });
    const previa = h('div', { class: 'previa' });
    const parc = h('input', { type: 'tel', inputmode: 'numeric', placeholder: 'Ex.: 12', autocomplete: 'off' });
    const ini = h('input', { type: 'tel', inputmode: 'numeric', placeholder: '1', autocomplete: 'off', value: '1' });
    const grupoIni = h('div', null, h('label', null, edicao ? 'Parcela Atual' : 'Começa na Parcela'), ini);

    // O valor é digitado em reais; a prévia mostra exatamente como será salvo
    let val = '';
    const atualizar = () => {
      const c = centavosDe(valor.value);
      val = canonico(c);
      previa.textContent = '= ' + moeda(c / 100);
    };
    valor.addEventListener('input', atualizar);
    valor.addEventListener('blur', () => { const c = centavosDe(valor.value); valor.value = c ? nf.format(c / 100) : ''; atualizar(); });
    const mostrarIni = () => { grupoIni.style.display = inteiro(parc.value) >= 2 ? 'block' : 'none'; };
    parc.addEventListener('input', mostrarIni);

    if (edicao) {
      nome.value = editar.n;
      const v0 = parse(editar.v);
      valor.value = v0 > 0 ? nf.format(v0) : '';
      if (editar.pt >= 2) { parc.value = String(editar.pt); ini.value = String(editar.pc); }
    }
    atualizar();
    mostrarIni();

    box.append(
      h('h2', null, edicao ? 'Editar Despesa' : 'Nova Despesa'),
      h('label', null, 'Nome'), nome,
      h('label', null, 'Valor em Reais'), valor, previa,
      h('label', null, 'Parcelas (Opcional)'), parc,
      grupoIni,
      h('div', { class: 'acoes' },
        h('button', { class: 'btn med cinza', onclick: fechar }, 'Cancelar'),
        h('button', {
          class: 'btn med',
          onclick: () => {
            atualizar();
            let total = Math.min(inteiro(parc.value), 120);
            let inicio = inteiro(ini.value);
            if (total >= 2) {
              if (inicio < 1) inicio = 1;
              if (inicio > total) { aviso(`${edicao ? 'A Parcela Atual' : 'A Parcela Inicial'} Não Pode Passar de ${total}`); return; }
            } else {
              total = 0;
            }
            const nm = nome.value.trim();
            if (edicao) editarDespesa(editar, nm, val, total, inicio);
            else criarDespesa(nm, val, total, inicio);
            fechar();
          },
        }, edicao ? 'Salvar' : 'Adicionar')),
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

// Aplica a edição. Nome e valor valem só para esta despesa; já as parcelas refazem
// as parcelas dos meses seguintes da mesma compra.
function editarDespesa(it, nome, valor, total, atual) {
  const eraParcela = it.pt > 0;
  const aplicar = () => {
    it.n = nome;
    it.v = valor;
    if (!eraParcela && total >= 2) { // passa a ser parcelada
      it.g = String(Date.now()) + Math.floor(Math.random() * 1e6);
      it.pc = atual;
      it.pt = total;
      criarProximas(it);
    } else if (eraParcela && total < 2) { // deixa de ser parcelada
      removerPosteriores(it.g);
      delete it.g; delete it.pc; delete it.pt;
    } else if (eraParcela && (total !== it.pt || atual !== it.pc)) { // muda as parcelas
      removerPosteriores(it.g);
      ajustarTotalAnteriores(it.g, total);
      it.pc = atual;
      it.pt = total;
      criarProximas(it);
    }
    salvar();
    render();
  };
  if (eraParcela && total < 2 && existemPosteriores(it.g)) {
    opcoes('Esta Despesa Deixará de Ser Parcelada e as Parcelas dos Próximos Meses Serão Removidas.',
      ['Remover e Salvar', 'Cancelar'], [aplicar, null]);
  } else {
    aplicar();
  }
}

const chavesApos = () => Object.keys(db.meses).filter((k) => k > keyOf(ano, mes));
const chavesAntes = () => Object.keys(db.meses).filter((k) => k < keyOf(ano, mes));
const existemPosteriores = (g) => chavesApos().some((k) => db.meses[k].some((x) => x.g === g));

function removerPosteriores(g) {
  for (const k of chavesApos()) db.meses[k] = db.meses[k].filter((x) => x.g !== g);
}

// Nos meses antes do atual, atualiza o "total" mostrado em (n/total)
function ajustarTotalAnteriores(g, novoTotal) {
  for (const k of chavesAntes()) db.meses[k].forEach((x) => { if (x.g === g) x.pt = novoTotal; });
}

// Cria as parcelas seguintes de it (que já tem pc/pt/g) nos meses depois do atual
function criarProximas(it) {
  for (let k = it.pc + 1; k <= it.pt; k++) {
    const idx = ano * 12 + mes + (k - it.pc);
    listaDe(keyOf(Math.floor(idx / 12), idx % 12)).push(novoItem({ n: it.n, v: it.v, pc: k, pt: it.pt, g: it.g }));
  }
}

function apagarProximas(it) {
  const fora = (x) => x.g === it.g && x.pc >= it.pc;
  for (const k of chavesApos()) db.meses[k] = db.meses[k].filter((x) => !fora(x));
  db.meses[keyOf(ano, mes)] = itens().filter((x) => !fora(x));
  salvar();
  render();
}

function apagar(it) {
  const nm = it.n ? it.n : 'Esta Despesa';
  const so = () => { db.meses[keyOf(ano, mes)] = itens().filter((x) => x !== it); salvar(); render(); };
  if (it.pt > 0) {
    opcoes(`Apagar "${nm}" (${it.pc}/${it.pt})?`, ['Só Esta', 'Esta e as Próximas', 'Cancelar'], [so, () => apagarProximas(it), null]);
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
  aviso(`Despesas de ${MESES[m]} Trazidas`);
}

/* ---------- tela principal ---------- */

const el = {};

const PONTOS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="5" r="2.2" fill="#fff"/><circle cx="12" cy="12" r="2.2" fill="#fff"/><circle cx="12" cy="19" r="2.2" fill="#fff"/></svg>';

function montar() {
  const app = document.getElementById('app');
  el.mes = h('div', { class: 'mes' });
  el.total = h('div', { class: 'total' });
  el.pago = h('i');
  el.resto = h('i');
  el.conteudo = h('div', { class: 'conteudo' });
  el.lista = h('div', { class: 'lista' }, el.conteudo);
  el.barra = h('div', { class: 'barra' });
  const menu = h('button', { class: 'gear', 'aria-label': 'Configurações', onclick: abrirConfig });
  menu.innerHTML = PONTOS;

  app.append(
    h('div', { class: 'topo' },
      h('div', { class: 'navwrap' },
        h('div', { class: 'nav' },
          h('button', { 'aria-label': 'Mês Anterior', onclick: () => mudarMes(-1) }, '◀'),
          el.mes,
          h('button', { 'aria-label': 'Próximo Mês', onclick: () => mudarMes(1) }, '▶')),
        menu),
      h('div', { class: 'rotulo' }, '💰 TOTAL A PAGAR'),
      el.total,
      h('div', { class: 'progresso' }, el.pago, el.resto)),
    h('div', { class: 'titulos' }, h('div', null, 'Despesa'), h('div', null, 'Valor'), h('div', null, 'Status'), h('div')),
    el.lista,
    el.barra,
  );
  habilitarArrasto();
}

function mudarMes(d) {
  mes += d;
  if (mes < 0) { mes = 11; ano--; }
  if (mes > 11) { mes = 0; ano++; }
  render();
  el.lista.scrollTop = 0;
}

// Arrastar a lista para os lados troca de mês (esquerda = seguinte, direita = anterior)
function habilitarArrasto() {
  let x0 = 0, y0 = 0, modo = null, dx = 0;
  const c = el.conteudo;
  el.lista.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { modo = 'v'; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; modo = null; dx = 0;
    c.style.transition = 'none';
  }, { passive: true });
  el.lista.addEventListener('touchmove', (e) => {
    if (modo === 'v' || e.touches.length !== 1) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (modo === null) {
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) modo = 'h';
      else if (Math.abs(my) > 12) modo = 'v';
    }
    if (modo === 'h') { dx = mx; c.style.transform = `translateX(${dx}px)`; e.preventDefault(); }
  }, { passive: false });
  const fim = () => {
    if (modo !== 'h') { modo = null; return; }
    modo = null;
    const w = el.lista.clientWidth;
    c.style.transition = 'transform .14s ease-out';
    if (Math.abs(dx) > w * 0.22) {
      const dir = dx < 0 ? 1 : -1;
      c.style.transform = `translateX(${-dir * w}px)`;
      setTimeout(() => {
        mudarMes(dir);
        c.style.transition = 'none';
        c.style.transform = `translateX(${dir * w}px)`;
        void c.offsetWidth;
        c.style.transition = 'transform .16s ease-out';
        c.style.transform = 'translateX(0)';
      }, 140);
    } else {
      c.style.transform = 'translateX(0)';
    }
  };
  el.lista.addEventListener('touchend', fim);
  el.lista.addEventListener('touchcancel', fim);
}

function atualizarTotal() {
  let aPagar = 0, pago = 0;
  for (const it of itens()) (it.p ? (pago += parse(it.v)) : (aPagar += parse(it.v)));
  el.total.textContent = moeda(aPagar);
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
    el.conteudo.replaceChildren(h('div', { class: 'vazio' }, '🐷\nNenhuma Despesa neste Mês.\nToque em “+ Despesa” ou\nTraga as do Mês Anterior.'));
    return;
  }
  // A PAGAR em cima e PAGO embaixo, cada grupo da mais cara para a mais barata
  const ordem = [...lista.filter((i) => !i.p).sort(porValor), ...lista.filter((i) => i.p).sort(porValor)];
  el.conteudo.replaceChildren(...ordem.map(linha));
}

function renderBarra() {
  // O botão de trazer despesas só aparece enquanto o mês não tem nenhuma despesa comum
  // (parcelas automáticas não contam)
  const origem = temComum(itens()) ? null : acharOrigem();
  el.barra.replaceChildren(...[
    origem && h('button', { class: 'btn copiar', onclick: () => trazer(origem[0], origem[1]) }, `⟲ Trazer de ${MESES[origem[1]]}`),
    h('button', { class: 'btn', onclick: () => formulario() }, '+ Despesa'),
  ].filter(Boolean));
}

// Segurar (500 ms) abre a edição; o toque simples não faz nada.
function aoSegurar(alvo, cb) {
  let t = null, x0 = 0, y0 = 0, disparou = false;
  const cancelar = () => { if (t) { clearTimeout(t); t = null; } };
  alvo.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    disparou = false; x0 = e.clientX; y0 = e.clientY;
    cancelar();
    t = setTimeout(() => { t = null; disparou = true; if (navigator.vibrate) navigator.vibrate(15); cb(); }, 500);
  });
  alvo.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancelar(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => alvo.addEventListener(n, cancelar));
  // depois de segurar, o "clique" que o navegador gera ao soltar não deve alternar o status
  alvo.addEventListener('click', (e) => { if (disparou) { e.preventDefault(); e.stopPropagation(); disparou = false; } }, true);
  alvo.addEventListener('contextmenu', (e) => e.preventDefault());
}

function linha(it) {
  const fixo = it.pt > 0 ? ` (${it.pc}/${it.pt})` : '';
  const nome = h('div', { class: 'nome' }, it.n ? it.n + fixo : fixo ? fixo.trim() : h('span', { class: 'ph' }, 'Despesa'));
  const val = h('div', { class: 'val' }, fmt(parse(it.v)) || h('span', { class: 'ph' }, '0,00'));
  ajustarFonte(val, fmt(parse(it.v)).length);
  const pill = h('button', {
    class: 'pill',
    onclick: () => { it.p = !it.p; salvar(); render(); },
  }, it.p ? 'PAGO' : 'A PAGAR');

  const r = h('div', { class: 'linha' + (it.p ? ' pago' : '') },
    nome,
    h('div', null, val),
    h('div', null, pill),
    h('div', null, h('button', { class: 'x', 'aria-label': 'Apagar', onclick: () => apagar(it) }, '✕')));
  aoSegurar(r, () => formulario(it));
  return r;
}

function ajustarFonte(elemento, n) {
  elemento.style.fontSize = n > 12 ? '11px' : n > 10 ? '13px' : n > 9 ? '14px' : '';
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
    class: 'sw' + (db.config.escuro ? ' on' : ''), role: 'switch', 'aria-checked': String(db.config.escuro), 'aria-label': 'Tema Escuro',
    onclick: () => { db.config.escuro = !db.config.escuro; salvar(); aplicarTema(); renderConfig(); },
  });

  const arquivo = h('input', { type: 'file', accept: '.json,application/json,text/plain', style: 'display:none' });
  arquivo.addEventListener('change', () => { if (arquivo.files[0]) importar(arquivo.files[0]); arquivo.value = ''; });

  pagina.replaceChildren(
    topo,
    h('div', { class: 'cartao' }, h('div', { class: 'linha-sw' }, h('div', { class: 'tit' }, '🌙 Tema Escuro'), sw)),
    paleta('🎨 Cor das Despesas A PAGAR', 'apagar'),
    paleta('🎨 Cor das Despesas PAGO', 'pago'),
    paleta('🎨 Cor do Botão + Despesa', 'botao'),
    h('div', { class: 'cartao' },
      h('div', { class: 'tit' }, '📄 Relatório do Mês'),
      h('div', { class: 'desc' }, 'Gera um Relatório Detalhado das Despesas de um Mês, para Salvar em PDF ou Imprimir.'),
      h('button', { class: 'btn', onclick: escolherMesRelatorio }, 'Gerar Relatório do Mês')),
    h('div', { class: 'cartao' },
      h('div', { class: 'tit' }, '💾 Backup'),
      h('div', { class: 'desc' }, 'Exporte as Despesas para um Arquivo ou Importe o Arquivo Gerado pelo App Android.'),
      h('button', { class: 'btn copiar', onclick: exportar }, 'Exportar Dados'),
      h('button', { class: 'btn', onclick: () => arquivo.click() }, 'Importar Dados'),
      arquivo),
    h('div', { class: 'cartao', style: 'background:none;box-shadow:none;padding:0' },
      h('button', {
        class: 'btn',
        onclick: () => { db.config = Object.assign({}, PADRAO); salvar(); aplicarTema(); renderConfig(); },
      }, 'Restaurar Padrão')),
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
  baixar(new Blob([json], { type: 'application/json' }), nome);
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
    try { novo = lerBackup(String(leitor.result)); } catch (e) { aviso('Arquivo de Backup Inválido'); return; }
    const total = Object.values(novo.meses).reduce((s, l) => s + l.length, 0);
    const aplicar = () => {
      db = { meses: novo.meses, config: novo.config };
      salvar();
      aplicarTema();
      renderConfig();
      aviso(`Backup Importado: ${total} Despesas`);
    };
    const existe = Object.values(db.meses).some((l) => l.length);
    if (!existe) aplicar();
    else opcoes(`Importar ${total} Despesas e Substituir os Dados Atuais Deste Aparelho?`, ['Substituir Tudo', 'Cancelar'], [aplicar, null]);
  };
  leitor.readAsText(arquivo);
}

/* ---------- relatório do mês ---------- */

function escolherMesRelatorio() {
  modal((box, fechar) => {
    const sel = { m: mes, a: ano };
    const tvMes = h('div', { class: 'sel-valor' }, MESES[sel.m]);
    const tvAno = h('div', { class: 'sel-valor' }, String(sel.a));
    const seletor = (rotulo, tv, menos, mais) => h('div', null,
      h('label', null, rotulo),
      h('div', { class: 'seletor' }, h('button', { onclick: menos }, '◀'), tv, h('button', { onclick: mais }, '▶')));
    box.append(
      h('h2', null, 'Gerar Relatório'),
      seletor('Mês', tvMes,
        () => { sel.m = (sel.m + 11) % 12; tvMes.textContent = MESES[sel.m]; },
        () => { sel.m = (sel.m + 1) % 12; tvMes.textContent = MESES[sel.m]; }),
      seletor('Ano', tvAno,
        () => { if (sel.a > 2000) sel.a--; tvAno.textContent = String(sel.a); },
        () => { if (sel.a < 2100) sel.a++; tvAno.textContent = String(sel.a); }),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn med cinza', onclick: fechar }, 'Cancelar'),
        h('button', { class: 'btn med', onclick: () => { fechar(); abrirRelatorio(sel.a, sel.m); } }, 'Gerar')));
  });
}

function dadosRelatorio(a, m) {
  const lista = (db.meses[keyOf(a, m)] || []).slice().sort(porValor);
  let total = 0;
  const linhas = lista.map((it) => {
    const v = parse(it.v);
    total += v;
    return { nome: (it.n || '').trim() || '(Sem Nome)', parcela: it.pt > 0 ? `${it.pc}/${it.pt}` : '—', valor: moeda(v) };
  });
  const d = new Date();
  const dd = (n) => String(n).padStart(2, '0');
  return {
    ano: a, mes: m, titulo: `${MESES[m]} de ${a}`, linhas, total: moeda(total), qtd: lista.length,
    geradoEm: `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()} às ${dd(d.getHours())}:${dd(d.getMinutes())}`,
  };
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function abrirRelatorio(a, m) {
  const r = dadosRelatorio(a, m);
  if (!r.qtd) { aviso(`Não Há Despesas em ${MESES[m]} de ${a}`); return; }
  const folha = h('div', { class: 'folha' });
  folha.innerHTML =
    `<h1>Relatório de Despesas</h1><div class="sub">${r.titulo} &nbsp;•&nbsp; Gerado em ${r.geradoEm}</div>` +
    `<div class="resumo"><div class="t">TOTAL DO MÊS (${r.qtd} ${r.qtd === 1 ? 'Despesa' : 'Despesas'})</div><div class="v">${r.total}</div></div>` +
    '<table><thead><tr><th class="n">#</th><th>Despesa</th><th class="c">Parcela</th><th class="r">Valor</th></tr></thead><tbody>' +
    r.linhas.map((l, i) => `<tr><td class="n">${i + 1}</td><td>${escHtml(l.nome)}</td><td class="c">${l.parcela}</td><td class="r">${l.valor}</td></tr>`).join('') +
    `</tbody><tfoot><tr><td></td><td colspan="2">TOTAL DO MÊS</td><td class="r">${r.total}</td></tr></tfoot></table>` +
    '<div class="rod">Contas — Controle Financeiro</div>';

  const pag = h('div', { class: 'pagina rel' },
    h('div', { class: 'topo' },
      h('div', { class: 'navwrap' },
        h('button', { class: 'gear', 'aria-label': 'Voltar', onclick: () => pag.remove() }, '◀'),
        h('div', { class: 'tt' }, 'Relatório'))),
    h('div', { class: 'rel-acoes' },
      h('button', { class: 'btn med', onclick: () => salvarPdf(r) }, 'Salvar em PDF'),
      h('button', { class: 'btn med copiar', onclick: () => window.print() }, 'Imprimir')),
    folha,
    h('div', { class: 'fundo-pagina' }));
  document.body.append(pag);
}

/* ---------- PDF (gerado no próprio aparelho) ---------- */

const medidor = document.createElement('canvas').getContext('2d');
function largura(txt, tam, negrito) {
  medidor.font = `${negrito ? 'bold ' : ''}${tam}px Arial, Helvetica, sans-serif`;
  return medidor.measureText(txt).width;
}

// Converte texto para a codificação WinAnsi do PDF (cobre acentos do português)
function pdfTexto(s) {
  const esp = { '—': 0x97, '•': 0x95, '…': 0x85, '“': 0x93, '”': 0x94, '’': 0x92, '‘': 0x91 };
  let out = '';
  for (const ch of String(s).replace(/ /g, ' ')) {
    let c = ch.charCodeAt(0);
    if (esp[ch]) c = esp[ch];
    else if (c > 255) c = 63; // ?
    const t = String.fromCharCode(c);
    out += t === '\\' || t === '(' || t === ')' ? '\\' + t : t;
  }
  return out;
}

function quebrar(txt, maxW, tam) {
  const linhas = [];
  let atual = '';
  for (const palavra of String(txt).split(/\s+/)) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (largura(teste, tam, false) <= maxW || !atual) atual = teste;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function gerarPdf(r) {
  const W = 595.28, H = 841.89, M = 45;
  const cor = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  const paginas = [];
  let ops;
  let y; // distância do topo
  const Y = (v) => (H - v).toFixed(2);
  const rect = (x, top, w, hh, fill) => { ops.push(`${cor(fill)} rg ${x.toFixed(2)} ${Y(top + hh)} ${w.toFixed(2)} ${hh.toFixed(2)} re f`); };
  const retaS = (x, top, w, hh, stroke) => { ops.push(`${cor(stroke)} RG 0.8 w ${x.toFixed(2)} ${Y(top + hh)} ${w.toFixed(2)} ${hh.toFixed(2)} re S`); };
  const linhaH = (x1, x2, top, stroke, esp) => { ops.push(`${cor(stroke)} RG ${esp} w ${x1.toFixed(2)} ${Y(top)} m ${x2.toFixed(2)} ${Y(top)} l S`); };
  const texto = (txt, x, base, tam, negrito, fill, alinh = 'e', larg = 0) => {
    const w = largura(txt, tam, negrito);
    const px = alinh === 'd' ? x + larg - w : alinh === 'c' ? x + (larg - w) / 2 : x;
    ops.push(`BT /${negrito ? 'F2' : 'F1'} ${tam} Tf ${cor(fill)} rg 1 0 0 1 ${px.toFixed(2)} ${Y(base)} Tm (${pdfTexto(txt)}) Tj ET`);
  };
  const novaPagina = () => { ops = []; paginas.push(ops); y = M; };

  const cN = 26, cP = 70, cV = 105; // colunas fixas
  const xN = M, xD = M + cN, xP = W - M - cV - cP, xV = W - M - cV, cD = xP - xD, larg = W - 2 * M;
  const cabecalho = () => {
    rect(M, y, larg, 24, '#1A237E');
    texto('#', xN, y + 16, 10, true, '#FFFFFF', 'c', cN);
    texto('Despesa', xD + 6, y + 16, 10, true, '#FFFFFF');
    texto('Parcela', xP, y + 16, 10, true, '#FFFFFF', 'c', cP);
    texto('Valor', xV, y + 16, 10, true, '#FFFFFF', 'd', cV - 8);
    y += 24;
  };

  novaPagina();
  texto('Relatório de Despesas', M, y + 20, 20, true, '#1A237E');
  texto(`${r.titulo}  •  Gerado em ${r.geradoEm}`, M, y + 40, 10, false, '#607D8B');
  y += 58;
  retaS(M, y, larg, 50, '#C5CAE9');
  texto(`TOTAL DO MÊS (${r.qtd} ${r.qtd === 1 ? 'Despesa' : 'Despesas'})`, M, y + 19, 9, false, '#607D8B', 'c', larg);
  texto(r.total, M, y + 40, 16, true, '#263238', 'c', larg);
  y += 66;
  cabecalho();

  const limite = H - M - 30;
  r.linhas.forEach((l, i) => {
    const nomes = quebrar(l.nome, cD - 12, 11);
    const alt = Math.max(24, nomes.length * 14 + 10);
    if (y + alt > limite) { novaPagina(); cabecalho(); }
    if (i % 2 === 1) rect(M, y, larg, alt, '#F5F6FB');
    texto(String(i + 1), xN, y + 16, 10, false, '#90A4AE', 'c', cN);
    nomes.forEach((n, k) => texto(n, xD + 6, y + 16 + k * 14, 11, false, '#263238'));
    texto(l.parcela, xP, y + 16, 11, false, '#263238', 'c', cP);
    texto(l.valor, xV, y + 16, 11, false, '#263238', 'd', cV - 8);
    linhaH(M, M + larg, y + alt, '#E0E4F0', 0.6);
    y += alt;
  });
  if (y + 34 > limite) { novaPagina(); cabecalho(); }
  linhaH(M, M + larg, y, '#1A237E', 1.6);
  texto('TOTAL DO MÊS', xD + 6, y + 22, 12, true, '#263238');
  texto(r.total, xV, y + 22, 12, true, '#263238', 'd', cV - 8);

  // rodapé em todas as páginas
  paginas.forEach((p, i) => {
    ops = p;
    texto('Contas — Controle Financeiro', M, H - 24, 9, false, '#90A4AE', 'c', larg);
    texto(`Página ${i + 1} de ${paginas.length}`, M, H - 24, 9, false, '#90A4AE', 'd', larg);
  });

  // monta o arquivo PDF
  const objs = [];
  const n = paginas.length;
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${5 + 2 * i} 0 R`).join(' ')}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  paginas.forEach((p, i) => {
    const conteudo = p.join('\n');
    objs[5 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`;
    objs[6 + 2 * i] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
  });
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offs = [];
  for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

async function salvarPdf(r) {
  const nome = `Relatorio-Contas-${r.ano}-${String(r.mes + 1).padStart(2, '0')}.pdf`;
  const arq = new File([gerarPdf(r)], nome, { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      await navigator.share({ files: [arq], title: nome });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  baixar(arq, nome);
}

/* ---------- início ---------- */

aplicarTema();
montar();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
