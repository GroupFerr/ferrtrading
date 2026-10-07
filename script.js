// ==================== ESTADO ====================
let estado = {
  bancaInicial: 0,
  operacoes: [],
  depositos: [],
  saques: [],
  percentualEntrada: 1,
  ocultarValores: false,
  metaMensal: 0,
  ativos: ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'],
  ativoSelecionado: null,
  mesCalendario: new Date().getMonth(),
  anoCalendario: new Date().getFullYear(),
  membroDesde: null
};

let syncAtivo = false;
let debounceSync = null;

// ==================== SYNC ====================
async function enviarPraNuvem() {
  if (!syncAtivo || !window.__fb) return;
  const { auth, db, doc, setDoc } = window.__fb;
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, 'usuarios', user.uid), estado);
    console.log('☁️ Dados enviados pra nuvem');
  } catch (e) { console.error('Erro ao enviar pra nuvem:', e); }
}

function agendarSync() {
  if (!syncAtivo) return;
  clearTimeout(debounceSync);
  debounceSync = setTimeout(enviarPraNuvem, 1500);
}

window.carregarDadosDaNuvem = function(dadosNuvem) {
  if (!dadosNuvem) return;
  estado = { ...estado, ...dadosNuvem };
  if (!estado.ativos || estado.ativos.length === 0) {
    estado.ativos = ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'];
  }
  if (!estado.membroDesde) {
    estado.membroDesde = new Date().toISOString();
    enviarPraNuvem();
  }
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  syncAtivo = true;
  renderizarDropdownAtivos();
  renderizar();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  toast('☁️ Dados sincronizados', 'sucesso', 2000);
};

window.enviarDadosPraNuvem = function() {
  syncAtivo = true;
  if (!estado.membroDesde) {
    estado.membroDesde = new Date().toISOString();
  }
  enviarPraNuvem();
};

function salvar() {
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  agendarSync();
}

function carregar() {
  const dados = localStorage.getItem('ferrTrading');
  if (dados) estado = { ...estado, ...JSON.parse(dados) };
  if (!estado.ativos || estado.ativos.length === 0) {
    estado.ativos = ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'];
  }
  const hoje = new Date();
  const inputData = document.getElementById('inputData');
  const inputHora = document.getElementById('inputHora');
  const inputDepositoData = document.getElementById('inputDepositoData');
  if (inputData) inputData.value = hoje.toISOString().split('T')[0];
  if (inputHora) inputHora.value = hoje.toTimeString().slice(0, 5);
  if (inputDepositoData) inputDepositoData.value = hoje.toISOString().split('T')[0];
}

// ==================== FORMATAÇÃO ====================
function formatarMoeda(valor) {
  if (estado.ocultarValores) return 'R$ ••••';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPercentual(valor) {
  if (estado.ocultarValores) return '••%';
  return valor.toFixed(1) + '%';
}

// ==================== TOASTS ====================
function toast(mensagem, tipo = 'info', duracao = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { sucesso: '✅', erro: '❌', info: 'ℹ️', aviso: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast tipo-${tipo}`;
  el.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span class="toast-msg">${mensagem}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  }, duracao);
}

// ==================== ANIMAÇÃO NÚMEROS ====================
function animarNumero(id, valorFinal) {
  const el = document.getElementById(id);
  if (!el) return;
  if (estado.ocultarValores) { el.textContent = formatarMoeda(valorFinal); return; }
  const textoAtual = el.textContent.replace(/[^\d,-]/g, '').replace(',', '.');
  const valorAtual = parseFloat(textoAtual) || 0;
  if (Math.abs(valorAtual - valorFinal) < 0.01) {
    el.textContent = formatarMoeda(valorFinal);
    return;
  }
  el.classList.add('numero-animando');
  setTimeout(() => el.classList.remove('numero-animando'), 400);
  const duracao = 500, passos = 20;
  const incremento = (valorFinal - valorAtual) / passos;
  let atual = valorAtual, passo = 0;
  const timer = setInterval(() => {
    passo++;
    atual += incremento;
    if (passo >= passos) { atual = valorFinal; clearInterval(timer); }
    el.textContent = formatarMoeda(atual);
  }, duracao / passos);
}

// ==================== CÁLCULOS ====================
function bancaAtual() {
  const totalOp = estado.operacoes.reduce((s, o) => s + o.valor, 0);
  const totalDep = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const totalSaq = estado.saques.reduce((s, x) => s + x.valor, 0);
  return estado.bancaInicial + totalOp + totalDep - totalSaq;
}

function operacoesDoDia(data) { return estado.operacoes.filter(o => o.data === data); }

function operacoesDaSemana() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay());
  inicio.setHours(0, 0, 0, 0);
  return estado.operacoes.filter(o => new Date(o.data + 'T00:00') >= inicio);
}

function operacoesDoMes(mesAno) { return estado.operacoes.filter(o => o.data.startsWith(mesAno)); }
function resultadoPeriodo(ops) { return ops.reduce((s, o) => s + o.valor, 0); }

function contarPorTipo(ops) {
  return {
    wins: ops.filter(o => o.tipo === 'WIN').length,
    losses: ops.filter(o => o.tipo === 'LOSS').length,
    empates: ops.filter(o => o.tipo === 'EMPATE').length
  };
}

function calcularSequencias() {
  const ops = estado.operacoes.slice().sort((a, b) => {
    const d = new Date(a.data + 'T' + (a.hora || '00:00'));
    const d2 = new Date(b.data + 'T' + (b.hora || '00:00'));
    return d - d2;
  });
  let seqAtual = 0, seqTipo = null;
  let maxWins = 0, maxLoss = 0, tempW = 0, tempL = 0;
  ops.forEach(o => {
    if (o.tipo === 'WIN') {
      tempW++; tempL = 0;
      maxWins = Math.max(maxWins, tempW);
      if (seqTipo === 'WIN') seqAtual++; else { seqTipo = 'WIN'; seqAtual = 1; }
    } else if (o.tipo === 'LOSS') {
      tempL++; tempW = 0;
      maxLoss = Math.max(maxLoss, tempL);
      if (seqTipo === 'LOSS') seqAtual++; else { seqTipo = 'LOSS'; seqAtual = 1; }
    }
  });
  return { seqAtual, seqTipo, maxWins, maxLoss };
}

function calcularMetaStop() {
  const hoje = new Date().toISOString().split('T')[0];
  const opsHoje = operacoesDoDia(hoje);
  const { wins, losses } = contarPorTipo(opsHoje);
  const banca = bancaAtual();
  const resultadoHoje = resultadoPeriodo(opsHoje);
  let metaPercentual;
  if (wins >= 12 && losses <= 2) metaPercentual = 50;
  else if (wins >= 10) metaPercentual = 30;
  else if (wins >= 6) metaPercentual = 20;
  else metaPercentual = 10;
  const stopPercentual = wins > 20 ? 10 : 5;
  const stopGanho = resultadoHoje > 0 ? resultadoHoje * (stopPercentual / 100) : Infinity;
  const stopBanca = banca * (stopPercentual / 100);
  const stopFinal = Math.min(stopGanho, stopBanca);
  return {
    metaValor: banca * (metaPercentual / 100),
    metaPercentual,
    stopValor: stopFinal === Infinity ? stopBanca : stopFinal,
    stopPercentual,
    resultadoHoje,
    winsHoje: wins
  };
}

function calcularKelly() {
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN');
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { kelly: 0, info: 'Precisa de wins e losses no histórico' };
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  if (perdaMedia === 0) return { kelly: 0, info: 'Sem perdas registradas' };
  const b = ganhoMedio / perdaMedia;
  const total = wins.length + losses.length;
  const p = wins.length / total;
  const q = 1 - p;
  const kelly = ((p * b - q) / b) * 100;
  const kellyMeio = kelly / 2;
  return {
    kelly: Math.max(0, kelly),
    kellyMeio: Math.max(0, kellyMeio),
    info: `Cheio: ${Math.max(0, kelly).toFixed(1)}% · Meio: ${Math.max(0, kellyMeio).toFixed(1)}%`
  };
}

function calcularDrawdown() {
  if (estado.operacoes.length === 0) return { maxDD: 0, atualDD: 0, info: 'Sem dados ainda' };
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial;
  let topo = saldo;
  let maxDD = 0, maxDDValor = 0;
  ops.forEach(o => {
    saldo += o.valor;
    if (saldo > topo) topo = saldo;
    const dd = topo > 0 ? ((topo - saldo) / topo) * 100 : 0;
    if (dd > maxDD) { maxDD = dd; maxDDValor = topo - saldo; }
  });
  const ddAtual = topo > 0 ? ((topo - saldo) / topo) * 100 : 0;
  return {
    maxDD, maxDDValor, atualDD: ddAtual,
    info: `Atual: ${ddAtual.toFixed(1)}% · Máx: ${maxDDValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  };
}

function calcularVoceVoce() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diaSemana = hoje.getDay();
  const inicioSemanaAtual = new Date(hoje);
  inicioSemanaAtual.setDate(hoje.getDate() - diaSemana);
  const inicioSemanaPassada = new Date(inicioSemanaAtual);
  inicioSemanaPassada.setDate(inicioSemanaAtual.getDate() - 7);
  const opsSemanaAtual = estado.operacoes.filter(o => new Date(o.data + 'T00:00') >= inicioSemanaAtual);
  const opsSemanaPassada = estado.operacoes.filter(o => {
    const d = new Date(o.data + 'T00:00');
    return d >= inicioSemanaPassada && d < inicioSemanaAtual;
  });
  const resultadoSemanaAtual = opsSemanaAtual.reduce((s, o) => s + o.valor, 0);
  const resultadoSemanaPassada = opsSemanaPassada.reduce((s, o) => s + o.valor, 0);
  const diffSemana = resultadoSemanaAtual - resultadoSemanaPassada;
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const mesPassado = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoPassado = mesAtual === 0 ? anoAtual - 1 : anoAtual;
  const prefixoAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
  const prefixoPassado = `${anoPassado}-${String(mesPassado + 1).padStart(2, '0')}`;
  const opsMesAtual = estado.operacoes.filter(o => o.data.startsWith(prefixoAtual));
  const opsMesPassado = estado.operacoes.filter(o => o.data.startsWith(prefixoPassado));
  const resultadoMesAtual = opsMesAtual.reduce((s, o) => s + o.valor, 0);
  const resultadoMesPassado = opsMesPassado.reduce((s, o) => s + o.valor, 0);
  const diffMes = resultadoMesAtual - resultadoMesPassado;
  return {
    semanaAtual: resultadoSemanaAtual, semanaPassada: resultadoSemanaPassada, diffSemana,
    mesAtual: resultadoMesAtual, mesPassado: resultadoMesPassado, diffMes
  };
}

function calcularSharpe() {
  const ops = estado.operacoes;
  if (ops.length < 2) return { sharpe: 0, info: 'Precisa de pelo menos 2 operações' };
  const retornos = ops.map(o => o.valor);
  const media = retornos.reduce((s, r) => s + r, 0) / retornos.length;
  const variancia = retornos.reduce((s, r) => s + Math.pow(r - media, 2), 0) / retornos.length;
  const desvio = Math.sqrt(variancia);
  if (desvio === 0) return { sharpe: 0, info: 'Sem variação nas operações' };
  const sharpe = media / desvio;
  return { sharpe, info: sharpe > 2 ? 'Excelente' : sharpe > 1 ? 'Bom' : sharpe > 0 ? 'Razoável' : 'Ruim' };
}

function calcularPayoff() {
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN');
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { payoff: 0, info: 'Precisa de wins e losses' };
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  const payoff = perdaMedia === 0 ? 0 : ganhoMedio / perdaMedia;
  return { payoff, info: payoff > 2 ? 'Excelente' : payoff > 1 ? 'Bom' : 'Precisa melhorar' };
}

function calcularExpectancia() {
  const ops = estado.operacoes;
  if (ops.length === 0) return { expect: 0, info: 'Sem operações ainda' };
  const wins = ops.filter(o => o.tipo === 'WIN');
  const losses = ops.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { expect: 0, info: 'Precisa de wins e losses' };
  const taxaAcerto = wins.length / (wins.length + losses.length);
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  const expect = (taxaAcerto * ganhoMedio) - ((1 - taxaAcerto) * perdaMedia);
  return { expect, info: expect > 0 ? 'Positiva ✅' : 'Negativa ❌' };
}

function calcularFatorLucro() {
  const totalGanho = estado.operacoes.filter(o => o.valor > 0).reduce((s, o) => s + o.valor, 0);
  const totalPerdido = Math.abs(estado.operacoes.filter(o => o.valor < 0).reduce((s, o) => s + o.valor, 0));
  if (totalPerdido === 0) return { fator: 0, info: 'Sem perdas registradas' };
  const fator = totalGanho / totalPerdido;
  return { fator, info: fator > 2 ? 'Excelente' : fator > 1 ? 'Lucrativo' : 'Prejuízo' };
}

function calcularMetaMensal() {
  const hoje = new Date();
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const opsMes = operacoesDoMes(mesAno);
  const resultadoMes = resultadoPeriodo(opsMes);
  const meta = estado.metaMensal || 0;
  const percentual = meta > 0 ? Math.min(100, (resultadoMes / meta) * 100) : 0;
  return { meta, resultadoMes, percentual };
}

function calcularStatsConta() {
  const totalOps = estado.operacoes.length;
  const diasUnicos = new Set(estado.operacoes.map(o => o.data));
  const diasAtivos = diasUnicos.size;
  const banca = bancaAtual();
  const depositosTotal = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const roi = depositosTotal > 0 ? ((banca - depositosTotal) / depositosTotal) * 100 : 0;
  return { totalOps, diasAtivos, roi, banca };
}

// ==================== DROPDOWN DE ATIVOS ====================
function renderizarDropdownAtivos() {
  const lista = document.getElementById('dropdownAtivoLista');
  if (!lista) return;
  const btnAdicionar = document.getElementById('btnAdicionarAtivo');
  lista.querySelectorAll('.dropdown-item[data-ativo]').forEach(el => el.remove());
  estado.ativos.forEach(ativo => {
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    div.dataset.ativo = ativo;
    div.textContent = ativo;
    if (estado.ativoSelecionado === ativo) div.classList.add('selecionado');
    lista.insertBefore(div, btnAdicionar);
  });
  lista.querySelectorAll('.dropdown-item[data-ativo]').forEach(el => {
    el.addEventListener('click', () => {
      estado.ativoSelecionado = el.dataset.ativo;
      salvar();
      renderizarDropdownAtivos();
      fecharDropdownAtivo();
      atualizarTextoAtivo();
    });
  });
}

function atualizarTextoAtivo() {
  const texto = document.getElementById('dropdownAtivoTexto');
  if (!texto) return;
  if (estado.ativoSelecionado) {
    texto.textContent = estado.ativoSelecionado;
    texto.classList.add('escolhido');
  } else {
    texto.textContent = 'Escolher ativo';
    texto.classList.remove('escolhido');
  }
}

function abrirDropdownAtivo() {
  const lista = document.getElementById('dropdownAtivoLista');
  const btn = document.getElementById('dropdownAtivo');
  if (!lista || !btn) return;
  lista.style.display = 'block';
  btn.classList.add('aberto');
  setTimeout(() => {
    const selecionado = lista.querySelector('.dropdown-item.selecionado');
    if (selecionado) selecionado.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 50);
}

function fecharDropdownAtivo() {
  const lista = document.getElementById('dropdownAtivoLista');
  const btn = document.getElementById('dropdownAtivo');
  if (!lista || !btn) return;
  lista.style.display = 'none';
  btn.classList.remove('aberto');
  const addInput = document.getElementById('dropdownAddInput');
  if (addInput) addInput.style.display = 'none';
  const inputNovo = document.getElementById('inputNovoAtivo');
  if (inputNovo) inputNovo.value = '';
}

function inicializarDropdownAtivos() {
  const btn = document.getElementById('dropdownAtivo');
  const btnAdicionar = document.getElementById('btnAdicionarAtivo');
  const btnConfirmar = document.getElementById('btnConfirmarNovoAtivo');
  const btnCancelar = document.getElementById('btnCancelarNovoAtivo');
  const addInput = document.getElementById('dropdownAddInput');
  const inputNovo = document.getElementById('inputNovoAtivo');

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lista = document.getElementById('dropdownAtivoLista');
      if (lista && lista.style.display === 'block') {
        fecharDropdownAtivo();
      } else {
        abrirDropdownAtivo();
      }
    });
  }

  if (btnAdicionar) {
    btnAdicionar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addInput) addInput.style.display = 'flex';
      if (inputNovo) inputNovo.focus();
    });
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = (inputNovo?.value || '').trim().toUpperCase();
      if (!nome) { toast('Digite o nome do ativo', 'aviso'); return; }
      if (estado.ativos.includes(nome)) { toast('Esse ativo já existe', 'aviso'); return; }
      estado.ativos.push(nome);
      estado.ativoSelecionado = nome;
      salvar();
      renderizarDropdownAtivos();
      atualizarTextoAtivo();
      fecharDropdownAtivo();
      toast('✅ ' + nome + ' adicionado!', 'sucesso');
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addInput) addInput.style.display = 'none';
      if (inputNovo) inputNovo.value = '';
    });
  }

  if (inputNovo) {
    inputNovo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); btnConfirmar?.click(); }
    });
  }

  document.addEventListener('click', (e) => {
    const lista = document.getElementById('dropdownAtivoLista');
    if (lista && lista.style.display === 'block') {
      if (!e.target.closest('.form-campo-ativo')) fecharDropdownAtivo();
    }
  });

  renderizarDropdownAtivos();
  atualizarTextoAtivo();
}// ==================== RENDERIZAÇÃO PRINCIPAL ====================
function renderizar() {
  const banca = bancaAtual();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAno = hoje.slice(0, 7);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  animarNumero('bancaAtual', banca);
  const badgeSaldo = document.getElementById('badgeSaldo');
  if (badgeSaldo) {
    const resMes = resultadoPeriodo(operacoesDoMes(mesAno));
    const perc = banca > 0 ? (resMes / banca) * 100 : 0;
    badgeSaldo.textContent = (perc >= 0 ? '+' : '') + perc.toFixed(1) + '%';
    badgeSaldo.classList.toggle('negativo', perc < 0);
  }

  const entrada = banca * (estado.percentualEntrada / 100);
  set('entradaSugerida', formatarMoeda(entrada));
  set('percentualEntrada', estado.percentualEntrada + '% do saldo');

  const ms = calcularMetaStop();
  set('metaDia', formatarMoeda(ms.metaValor));
  set('metaInfo', `${ms.metaPercentual}% do saldo · ${ms.winsHoje} wins hoje`);
  set('stopDia', formatarMoeda(ms.stopValor));
  set('stopInfo', `${ms.stopPercentual}% · ${ms.winsHoje > 20 ? '10% (dia excepcional)' : '5% padrão'}`);

  const alerta = document.getElementById('alertaStop');
  if (alerta) alerta.style.display = (ms.resultadoHoje < 0 && Math.abs(ms.resultadoHoje) >= ms.stopValor) ? 'flex' : 'none';

  const opsDia = operacoesDoDia(hoje);
  const contDia = contarPorTipo(opsDia);
  set('winsHoje', contDia.wins);
  set('lossHoje', contDia.losses);
  set('empatesHoje', contDia.empates);

  const seq = calcularSequencias();
  const seqEl = document.getElementById('seqAtual');
  if (seqEl) {
    if (seq.seqTipo === 'WIN') { seqEl.textContent = seq.seqAtual + ' wins'; seqEl.style.color = '#00C98B'; }
    else if (seq.seqTipo === 'LOSS') { seqEl.textContent = seq.seqAtual + ' loss'; seqEl.style.color = '#FF3B55'; }
    else { seqEl.textContent = '-'; seqEl.style.color = ''; }
  }
  set('seqMaxWins', 'Máx: ' + seq.maxWins);
  set('seqMaxLoss', seq.maxLoss);

  const mm = calcularMetaMensal();
  set('metaMensalResultado', formatarMoeda(mm.resultadoMes));
  set('metaMensalFalta', formatarMoeda(Math.max(0, mm.meta - mm.resultadoMes)));
  set('metaMensalPercentual', mm.percentual.toFixed(1) + '%');

  const bvSub = document.getElementById('boasVindasSub');
  if (bvSub) {
    bvSub.textContent = `Sua banca está em ${formatarMoeda(banca)}.`;
  }

  renderizarSaque(banca);
  renderizarUltimasOperacoes();
  renderizarHistorico();
  renderizarResumoMensal();
  renderizarHorario();
  renderizarSaques();
  renderizarCalendario();
  renderizarGrafico();
  renderizarGraficoBarras();
  renderizarGraficoMetaMensal();
  renderizarTodosGraficos();
  renderizarAssertividadeRosca();

  const dataEl = document.getElementById('dataAtual');
  if (dataEl) {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', opcoes);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==================== RENDERIZAÇÃO DA PERFIL ====================
function renderizarPerfil() {
  if (!window.__fb || !window.__fb.auth.currentUser) return;
  const user = window.__fb.auth.currentUser;
  const email = user.email || 'sem email';
  
  const stats = calcularStatsConta();
  
  const emailEl = document.getElementById('perfilEmail');
  if (emailEl) emailEl.textContent = email;
  
  const avatarEl = document.getElementById('perfilAvatar');
  if (avatarEl) avatarEl.textContent = email.charAt(0).toUpperCase();
  
  const membroEl = document.getElementById('perfilMembro');
  if (membroEl) {
    const data = estado.membroDesde ? new Date(estado.membroDesde) : new Date();
    const mes = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    membroEl.textContent = `Membro desde ${mes}`;
  }
  
  const saldoEl = document.getElementById('perfilSaldo');
  if (saldoEl) saldoEl.textContent = formatarMoeda(stats.banca);
  
  const opsEl = document.getElementById('perfilTotalOps');
  if (opsEl) opsEl.textContent = stats.totalOps;
  
  const diasEl = document.getElementById('perfilDiasAtivos');
  if (diasEl) diasEl.textContent = stats.diasAtivos;
  
  const roiEl = document.getElementById('perfilROI');
  if (roiEl) {
    roiEl.textContent = (stats.roi >= 0 ? '+' : '') + stats.roi.toFixed(1) + '%';
    roiEl.style.color = stats.roi >= 0 ? 'var(--verde)' : 'var(--vermelho)';
  }
  
  const toggle = document.getElementById('toggleOcultarValores');
  if (toggle) {
    toggle.classList.toggle('ativo', estado.ocultarValores);
  }
}

// ==================== TROCAR SENHA ====================
async function trocarSenha() {
  const novaSenha = prompt('Digite sua NOVA senha (mín. 6 caracteres):');
  if (!novaSenha) return;
  if (novaSenha.length < 6) { toast('Senha muito curta (mín. 6)', 'erro'); return; }
  const confirmar = prompt('Confirme a nova senha:');
  if (novaSenha !== confirmar) { toast('Senhas não coincidem', 'erro'); return; }
  try {
    const { auth, updatePassword } = window.__fb;
    await updatePassword(auth.currentUser, novaSenha);
    toast('✅ Senha alterada com sucesso!', 'sucesso');
  } catch (e) {
    console.error(e);
    if (e.code === 'auth/requires-recent-login') {
      toast('Faça login novamente para trocar a senha', 'aviso', 5000);
    } else {
      toast('Erro ao trocar senha: ' + e.message, 'erro');
    }
  }
}

// ==================== TROCAR EMAIL ====================
async function trocarEmail() {
  const novoEmail = prompt('Digite seu NOVO email:');
  if (!novoEmail) return;
  if (!novoEmail.includes('@')) { toast('Email inválido', 'erro'); return; }
  if (!confirm('⚠️ IMPORTANTE: vai chegar um email de confirmação no NOVO endereço. Só depois de clicar no link a troca é efetiva.\n\nDeseja continuar?')) return;
  try {
    const { auth, updateEmail } = window.__fb;
    await updateEmail(auth.currentUser, novoEmail);
    toast('📧 Email alterado! Confirme no novo endereço.', 'sucesso', 6000);
  } catch (e) {
    console.error(e);
    if (e.code === 'auth/requires-recent-login') {
      toast('Faça login novamente para trocar o email', 'aviso', 5000);
    } else if (e.code === 'auth/email-already-in-use') {
      toast('Esse email já está em uso', 'erro');
    } else {
      toast('Erro ao trocar email: ' + e.message, 'erro');
    }
  }
}

// ==================== RESETAR SENHA POR EMAIL ====================
async function resetarSenhaEmail() {
  if (!window.__fb || !window.__fb.auth.currentUser) return;
  const email = window.__fb.auth.currentUser.email;
  if (!confirm(`Enviar email de recuperação para ${email}?`)) return;
  try {
    const { auth, sendPasswordResetEmail } = window.__fb;
    await sendPasswordResetEmail(auth, email);
    toast('📧 Email enviado! Verifique sua caixa de entrada.', 'sucesso', 5000);
  } catch (e) {
    console.error(e);
    toast('Erro ao enviar email: ' + e.message, 'erro');
  }
}

// ==================== ANÁLISE IA (GEMINI) ====================
async function analisarComIA() {
  if (!window.__fb || !window.__fb.model) {
    toast('IA não configurada. Ative o AI Logic no Firebase.', 'erro', 5000);
    return;
  }
  
  const ops = estado.operacoes;
  if (ops.length === 0) {
    toast('Registre pelo menos 1 operação primeiro', 'aviso');
    return;
  }
  
  const modal = document.getElementById('modalIA');
  const conteudo = document.getElementById('analiseIAConteudo');
  if (modal) modal.style.display = 'flex';
  if (conteudo) conteudo.innerHTML = '<p style="text-align:center;color:var(--texto-secundario);padding:40px;">🤖 Analisando seus dados... aguarde.</p>';
  
  const prompt = gerarTextoIA();
  
  try {
    const { model } = window.__fb;
    const result = await model.generateContent(prompt);
    const texto = result.response.text();
    
    if (conteudo) {
      conteudo.innerHTML = `
        <div class="ia-resposta">
          ${texto.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '<br>').join('')}
        </div>
      `;
    }
  } catch (e) {
    console.error('Erro IA:', e);
    if (conteudo) {
      conteudo.innerHTML = `<p style="color:var(--vermelho);text-align:center;padding:20px;">❌ Erro ao gerar análise.<br><small>${e.message}</small></p>`;
    }
  }
}

function gerarTextoIA() {
  const banca = bancaAtual();
  const ops = estado.operacoes;
  const wins = ops.filter(o => o.tipo === 'WIN');
  const losses = ops.filter(o => o.tipo === 'LOSS');
  const empates = ops.filter(o => o.tipo === 'EMPATE');
  const total = ops.length;
  const taxa = total > 0 ? (wins.length / total * 100) : 0;
  const ganhoTotal = wins.reduce((s, o) => s + o.valor, 0);
  const perdaTotal = Math.abs(losses.reduce((s, o) => s + o.valor, 0));
  const resultado = ganhoTotal - perdaTotal;
  const melhor = ops.reduce((m, o) => o.valor > m.valor ? o : m, ops[0]);
  const pior = ops.reduce((m, o) => o.valor < m.valor ? o : m, ops[0]);
  const sharpe = calcularSharpe();
  const payoff = calcularPayoff();
  const exp = calcularExpectancia();
  const fator = calcularFatorLucro();

  const porMes = {};
  ops.forEach(o => {
    const m = o.data.slice(0, 7);
    if (!porMes[m]) porMes[m] = { wins: 0, losses: 0, lucro: 0 };
    if (o.tipo === 'WIN') porMes[m].wins++;
    if (o.tipo === 'LOSS') porMes[m].losses++;
    porMes[m].lucro += o.valor;
  });

  let texto = '';
  texto += 'Sou trader e uso o FerrTrading para gerenciar minha banca. ';
  texto += 'Analise meus dados abaixo e me dê insights práticos sobre:\n';
  texto += '1. O que estou fazendo certo\n2. O que preciso melhorar\n';
  texto += '3. Padrões que você identifica\n4. Sugestões concretas para os próximos 30 dias\n\n';
  texto += '=== MEUS DADOS ===\n';
  texto += `Saldo atual: ${formatarMoeda(banca)}\n`;
  texto += `Banca inicial: ${formatarMoeda(estado.bancaInicial)}\n`;
  texto += `Total de operações: ${total}\n`;
  texto += `Wins: ${wins.length} | Loss: ${losses.length} | Empates: ${empates.length}\n`;
  texto += `Taxa de acerto: ${taxa.toFixed(1)}%\n`;
  texto += `Resultado total: ${formatarMoeda(resultado)}\n`;
  texto += `Total ganho: ${formatarMoeda(ganhoTotal)}\n`;
  texto += `Total perdido: ${formatarMoeda(perdaTotal)}\n`;
  texto += `Melhor operação: ${formatarMoeda(melhor.valor)}\n`;
  texto += `Pior operação: ${formatarMoeda(pior.valor)}\n\n`;
  texto += '=== MÉTRICAS ===\n';
  texto += `Sharpe Ratio: ${sharpe.sharpe.toFixed(2)} (${sharpe.info})\n`;
  texto += `Payoff: ${payoff.payoff.toFixed(2)} (${payoff.info})\n`;
  texto += `Expectância: ${formatarMoeda(exp.expect)} (${exp.info})\n`;
  texto += `Fator Lucro: ${fator.fator.toFixed(2)} (${fator.info})\n\n`;
  texto += '=== DESEMPENHO MENSAL ===\n';
  Object.keys(porMes).sort().forEach(m => {
    const d = porMes[m];
    texto += `${m.split('-').reverse().join('/')}: ${d.wins}W / ${d.losses}L | Lucro: ${formatarMoeda(d.lucro)}\n`;
  });
  texto += '\nSeja direto e prático. Foque no que posso mudar AGORA.';
  return texto;
}

// ==================== ÚLTIMAS OPERAÇÕES ====================
function renderizarUltimasOperacoes() {
  const container = document.getElementById('listaUltimasOperacoes');
  if (!container) return;
  const ops = estado.operacoes.slice().sort((a, b) => {
    const d = new Date(a.data + 'T' + (a.hora || '00:00'));
    const d2 = new Date(b.data + 'T' + (b.hora || '00:00'));
    return d2 - d;
  }).slice(0, 5);

  const badge = document.getElementById('ultimasBadge');
  const mesAno = new Date().toISOString().slice(0, 7);
  const mesOps = operacoesDoMes(mesAno);
  if (badge) badge.textContent = `+${mesOps.length} este mês`;

  if (ops.length === 0) {
    container.innerHTML = '<p class="placeholder-texto">Nenhuma operação registrada ainda</p>';
    return;
  }

  container.innerHTML = '';
  ops.forEach(o => {
    const tipoClass = o.tipo.toLowerCase();
    const icone = o.tipo === 'WIN' ? 'arrow-up-right' : o.tipo === 'LOSS' ? 'arrow-down-right' : 'minus';
    const sinal = o.valor > 0 ? '+' : '';
    const div = document.createElement('div');
    div.className = 'item-vision';
    div.innerHTML = `
      <div class="item-vision-icon ${tipoClass}">
        <i data-lucide="${icone}"></i>
      </div>
      <div class="item-vision-info">
        <div class="item-vision-titulo">${o.ativo || 'Sem ativo'}</div>
        <div class="item-vision-sub">${o.data.split('-').reverse().join('/')} · ${o.hora || '--:--'}</div>
      </div>
      <div class="item-vision-valor ${tipoClass}">${sinal}${formatarMoeda(o.valor)}</div>
    `;
    container.appendChild(div);
  });
}

// ==================== SAQUE ====================
function renderizarSaque(banca) {
  const hoje = new Date();
  const dia = hoje.getDate();
  const percentual = dia <= 15 ? 15 : 30;
  const tipo = dia <= 15 ? 'Quinzenal (15%)' : 'Mensal (30%)';
  const el1 = document.getElementById('proximoSaque');
  const el2 = document.getElementById('saqueInfo');
  if (el1) el1.textContent = formatarMoeda(banca * (percentual / 100));
  if (el2) el2.textContent = `${tipo} · dia ${dia}`;
}

// ==================== HISTÓRICO ====================
function renderizarHistorico() {
  const filtroEl = document.getElementById('filtroMes');
  const filtro = filtroEl ? filtroEl.value : '';
  let ops = estado.operacoes.slice().reverse();
  if (filtro) ops = ops.filter(o => o.data.startsWith(filtro));

  const badge = document.getElementById('historicoBadge');
  const mesAno = new Date().toISOString().slice(0, 7);
  if (badge) {
    const mesOps = estado.operacoes.filter(o => o.data.startsWith(mesAno));
    badge.textContent = `${mesOps.length} operações este mês`;
  }

  const corpo = document.getElementById('corpoHistorico');
  if (!corpo) return;
  corpo.innerHTML = '';

  if (ops.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--texto-terciario);padding:40px;">Nenhuma operação registrada</td></tr>';
    return;
  }

  ops.forEach((o) => {
    const tipoClass = o.tipo.toLowerCase();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.ativo || '-'}</td>
      <td>${o.data.split('-').reverse().join('/')}</td>
      <td>${o.hora || '-'}</td>
      <td><span class="badge-tabela ${tipoClass}">${o.tipo}</span></td>
      <td class="${tipoClass}">${formatarMoeda(o.valor)}</td>
      <td>
        <button class="btn-remover-vision" onclick="removerOperacao('${o.id}')"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    corpo.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==================== RESUMO MENSAL ====================
function renderizarResumoMensal() {
  const meses = {};
  estado.operacoes.forEach(o => {
    const mes = o.data.slice(0, 7);
    if (!meses[mes]) meses[mes] = { wins: 0, losses: 0, lucro: 0 };
    if (o.tipo === 'WIN') meses[mes].wins++;
    if (o.tipo === 'LOSS') meses[mes].losses++;
    meses[mes].lucro += o.valor;
  });
  const corpo = document.getElementById('corpoMensal');
  if (!corpo) return;
  corpo.innerHTML = '';
  const banca = bancaAtual();
  const mesAtual = new Date().toISOString().slice(0, 7);

  if (Object.keys(meses).length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--texto-terciario);padding:40px;">Sem dados ainda</td></tr>';
  }

  Object.keys(meses).sort().reverse().forEach(mes => {
    const m = meses[mes];
    const tr = document.createElement('tr');
    let metaTexto = '-';
    if (mes === mesAtual && estado.metaMensal > 0) {
      const p = ((m.lucro / estado.metaMensal) * 100).toFixed(0);
      metaTexto = `${p}%`;
    }
    tr.innerHTML = `
      <td>${mes.split('-').reverse().join('/')}</td>
      <td class="win">${m.wins}</td>
      <td class="loss">${m.losses}</td>
      <td class="${m.lucro >= 0 ? 'win' : 'loss'}">${formatarMoeda(m.lucro)}</td>
      <td>${metaTexto}</td>
      <td>${formatarMoeda(banca)}</td>
    `;
    corpo.appendChild(tr);
  });

  const filtro = document.getElementById('filtroMes');
  if (filtro) {
    const valorAtual = filtro.value;
    filtro.innerHTML = '<option value="">Todos os meses</option>';
    Object.keys(meses).sort().reverse().forEach(mes => {
      const opt = document.createElement('option');
      opt.value = mes;
      opt.textContent = mes.split('-').reverse().join('/');
      filtro.appendChild(opt);
    });
    filtro.value = valorAtual;
  }
}

// ==================== HORÁRIO ====================
function renderizarHorario() {
  const corpo = document.getElementById('corpoHorario');
  if (!corpo) return;
  corpo.innerHTML = '';
  const faixas = [
    { label: '00h - 06h', min: 0, max: 6 },
    { label: '06h - 09h', min: 6, max: 9 },
    { label: '09h - 12h', min: 9, max: 12 },
    { label: '12h - 15h', min: 12, max: 15 },
    { label: '15h - 18h', min: 15, max: 18 },
    { label: '18h - 21h', min: 18, max: 21 },
    { label: '21h - 00h', min: 21, max: 24 }
  ];
  faixas.forEach(f => {
    const ops = estado.operacoes.filter(o => {
      const h = parseInt((o.hora || '00:00').split(':')[0]);
      return h >= f.min && h < f.max;
    });
    const wins = ops.filter(o => o.tipo === 'WIN').length;
    const losses = ops.filter(o => o.tipo === 'LOSS').length;
    const resultado = resultadoPeriodo(ops);
    const assert = (wins + losses) === 0 ? 0 : (wins / (wins + losses)) * 100;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.label}</td>
      <td>${ops.length}</td>
      <td class="win">${wins}</td>
      <td class="loss">${losses}</td>
      <td class="${resultado >= 0 ? 'win' : 'loss'}">${formatarMoeda(resultado)}</td>
      <td>${formatarPercentual(assert)}</td>
    `;
    corpo.appendChild(tr);
  });
}

// ==================== SAQUES ====================
function renderizarSaques() {
  const container = document.getElementById('listaSaques');
  const saques = estado.saques.slice().reverse();
  const total = estado.saques.reduce((s, x) => s + x.valor, 0);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('saquesTotal', formatarMoeda(total));
  set('saquesQuantidade', estado.saques.length);
  if (saques.length > 0) {
    const ultimo = saques[0];
    set('saquesUltimo', ultimo.data.split('-').reverse().join('/') + ' · ' + formatarMoeda(ultimo.valor));
  } else {
    set('saquesUltimo', '-');
  }

  if (!container) return;
  container.innerHTML = '';

  if (saques.length === 0) {
    container.innerHTML = '<p class="placeholder-texto">Nenhum saque registrado ainda</p>';
    return;
  }

  saques.forEach(s => {
    const div = document.createElement('div');
    div.className = 'transacao-vision';
    div.innerHTML = `
      <div class="transacao-icon saida"><i data-lucide="arrow-up-right"></i></div>
      <div class="transacao-info">
        <div class="transacao-titulo">${s.tipo || 'Saque'}</div>
        <div class="transacao-sub">${s.data.split('-').reverse().join('/')}</div>
      </div>
      <div class="transacao-valor negativo">-${formatarMoeda(s.valor)}</div>
      <button class="btn-remover-vision" onclick="removerSaque('${s.id}')"><i data-lucide="trash-2"></i></button>
    `;
    container.appendChild(div);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.removerSaque = function(id) {
  if (!confirm('Remover este saque?')) return;
  estado.saques = estado.saques.filter(s => String(s.id) !== String(id));
  salvar();
  renderizar();
  toast('Saque removido', 'info');
};

// ==================== CALENDÁRIO ====================
function renderizarCalendario() {
  const grid = document.getElementById('calendarioGrid');
  const titulo = document.getElementById('tituloCalendario');
  if (!grid || !titulo) return;
  const ano = estado.anoCalendario;
  const mes = estado.mesCalendario;
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  titulo.textContent = nomesMes[mes] + ' ' + ano;
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  grid.innerHTML = '';
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dia-semana';
    el.textContent = d;
    grid.appendChild(el);
  });
  for (let i = 0; i < primeiroDia; i++) {
    const el = document.createElement('div');
    el.className = 'cal-dia vazio';
    grid.appendChild(el);
  }
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataStr = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const ops = operacoesDoDia(dataStr);
    const resultado = resultadoPeriodo(ops);
    const el = document.createElement('div');
    el.className = 'cal-dia';
    if (ops.length > 0) el.classList.add(resultado > 0 ? 'positivo' : resultado < 0 ? 'negativo' : '');
    el.innerHTML = `
      <div class="cal-dia-num">${dia}</div>
      <div class="cal-dia-valor">${ops.length > 0 ? formatarMoeda(resultado) : ''}</div>
    `;
    grid.appendChild(el);
  }
}

// ==================== AÇÕES ====================
function registrarOperacao(tipo) {
  const ativo = estado.ativoSelecionado || '';
  const valor = parseFloat(document.getElementById('inputValor').value);
  const data = document.getElementById('inputData').value;
  const hora = document.getElementById('inputHora').value;

  if (!ativo) return toast('Escolha um ativo primeiro.', 'erro');
  if (!data) return toast('Informe a data.', 'erro');
  if (isNaN(valor) || valor <= 0) return toast('Informe um valor válido.', 'erro');

  let valorFinal;
  if (tipo === 'LOSS') valorFinal = -Math.abs(valor);
  else if (tipo === 'EMPATE') valorFinal = 0;
  else valorFinal = Math.abs(valor);

  estado.operacoes.push({
    id: Date.now() + Math.random(),
    tipo, ativo, valor: valorFinal, data, hora
  });

  salvar();
  estado.ativoSelecionado = null;
  document.getElementById('inputValor').value = '';
  renderizarDropdownAtivos();
  atualizarTextoAtivo();
  renderizar();

  const emoji = tipo === 'WIN' ? '✅' : tipo === 'LOSS' ? '❌' : '➖';
  toast(emoji + ' ' + tipo + ' ' + ativo + ' registrado: ' + formatarMoeda(Math.abs(valorFinal)),
    tipo === 'WIN' ? 'sucesso' : tipo === 'LOSS' ? 'erro' : 'info');
}

function removerOperacao(id) {
  if (!confirm('Remover esta operação?')) return;
  estado.operacoes = estado.operacoes.filter(o => String(o.id) !== String(id));
  salvar();
  renderizar();
  toast('Operação removida', 'info');
}

function registrarSaque(percentual) {
  if (!percentual) {
    const hoje = new Date();
    percentual = hoje.getDate() <= 15 ? 15 : 30;
  }
  const banca = bancaAtual();
  if (banca <= 0) { toast('Saldo zerado. Não há o que sacar.', 'erro'); return; }

  const tipo = percentual === 15 ? 'Quinzenal' : 'Mensal';
  const valor = banca * (percentual / 100);
  if (!confirm('Registrar saque ' + percentual + '% (' + tipo + ')?\n\nSaldo: ' + formatarMoeda(banca) + '\nSaque: ' + formatarMoeda(valor))) return;

  estado.saques.push({
    id: Date.now(), valor,
    data: new Date().toISOString().split('T')[0],
    tipo
  });
  salvar();
  renderizar();
  toast('💸 Saque ' + tipo + ' registrado: ' + formatarMoeda(valor), 'sucesso');
}

function registrarDeposito() {
  const valor = parseFloat(document.getElementById('inputDeposito').value);
  const data = document.getElementById('inputDepositoData').value;
  const tipo = document.getElementById('inputDepositoTipo').value;
  if (isNaN(valor) || valor <= 0) return toast('Informe um valor válido.', 'erro');
  if (!data) return toast('Informe a data.', 'erro');
  if (tipo === 'DEPOSITO') estado.depositos.push({ id: Date.now(), valor, data });
  else estado.saques.push({ id: Date.now(), valor, data, tipo: 'Manual' });
  salvar();
  document.getElementById('inputDeposito').value = '';
  renderizar();
  toast((tipo === 'DEPOSITO' ? '💰 Depósito' : '💸 Saque') + ' registrado: ' + formatarMoeda(valor), 'sucesso');
}// ==================== GRÁFICOS ====================
let chartLinha = null;
let chartBarras = null;
let chartPizzaTipo = null;
let chartDiaSemana = null;
let chartKelly = null;
let chartDrawdown = null;
let chartSharpe = null;
let chartGanhoPerda = null;
let chartAtivo = null;
let chartMes = null;
let chartRosca = null;
let chartMetaMensal = null;

const COR_AZUL = '#0066FF';
const COR_AZUL_CLARO = '#1597FF';
const COR_AZUL_ESCURO = '#0755C9';
const COR_VERDE = '#00C98B';
const COR_VERMELHO = '#FF3B55';
const COR_AMARELO = '#FFB547';
const COR_TEXTO = '#8B9BC2';
const COR_GRID = '#102653';
const COR_FUNDO = '#061332';

const fmtMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function optsBase() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: COR_TEXTO, font: { size: 11, weight: '600' }, padding: 12, usePointStyle: true } },
      tooltip: {
        backgroundColor: COR_FUNDO,
        borderColor: COR_GRID,
        borderWidth: 1,
        titleColor: COR_AZUL_CLARO,
        bodyColor: '#F5F7FF',
        padding: 12, cornerRadius: 8, displayColors: false
      }
    }
  };
}

function escalas() {
  return {
    x: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
    y: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
  };
}

function renderizarGraficoMetaMensal() {
  const canvas = document.getElementById('graficoMetaMensal');
  if (!canvas || typeof Chart === 'undefined') return;
  const mm = calcularMetaMensal();
  const dados = [mm.percentual, Math.max(0, 100 - mm.percentual)];
  if (chartMetaMensal) {
    chartMetaMensal.data.datasets[0].data = dados;
    chartMetaMensal.update('none');
    return;
  }
  chartMetaMensal = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Concluído', 'Restante'],
      datasets: [{
        data: dados,
        backgroundColor: [COR_AZUL_CLARO, COR_GRID],
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '78%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderizarGrafico() {
  const canvas = document.getElementById('graficoBanca');
  if (!canvas || typeof Chart === 'undefined') return;
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial;
  const labels = ['Início'];
  const valores = [saldo];
  ops.forEach(o => {
    saldo += o.valor;
    labels.push(new Date(o.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(saldo);
  });
  if (chartLinha) {
    chartLinha.data.labels = labels;
    chartLinha.data.datasets[0].data = valores;
    chartLinha.update('none');
    return;
  }
  const ctx = canvas.getContext('2d');
  const gradiente = ctx.createLinearGradient(0, 0, 0, 320);
  gradiente.addColorStop(0, 'rgba(0, 102, 255, 0.4)');
  gradiente.addColorStop(1, 'rgba(0, 102, 255, 0)');
  chartLinha = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Saldo', data: valores,
        borderColor: COR_AZUL_CLARO, backgroundColor: gradiente,
        borderWidth: 2, fill: true, tension: 0.4,
        pointBackgroundColor: COR_AZUL_CLARO,
        pointBorderColor: COR_FUNDO,
        pointBorderWidth: 2, pointRadius: 0, pointHoverRadius: 6
      }]
    },
    options: {
      ...optsBase(),
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        ...optsBase().plugins,
        legend: { display: false },
        tooltip: {
          ...optsBase().plugins.tooltip,
          callbacks: { label: (ctx) => 'Saldo: ' + fmtMoeda(ctx.parsed.y) }
        }
      },
      scales: escalas()
    }
  });
}

function renderizarGraficoBarras() {
  const canvas = document.getElementById('graficoBarras');
  if (!canvas || typeof Chart === 'undefined') return;
  const hoje = new Date();
  const labels = [], valores = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const dataStr = d.toISOString().split('T')[0];
    const ops = operacoesDoDia(dataStr);
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(resultadoPeriodo(ops));
  }
  if (chartBarras) {
    chartBarras.data.labels = labels;
    chartBarras.data.datasets[0].data = valores;
    chartBarras.update('none');
    return;
  }
  chartBarras = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Resultado',
        data: valores,
        backgroundColor: '#F5F7FF',
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 8
      }]
    },
    options: {
      ...optsBase(),
      plugins: {
        ...optsBase().plugins,
        legend: { display: false },
        tooltip: {
          ...optsBase().plugins.tooltip,
          callbacks: { label: (ctx) => 'Resultado: ' + fmtMoeda(ctx.parsed.y) }
        }
      },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
        y: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

function renderizarPizzaTipo() {
  const canvas = document.getElementById('graficoPizzaTipo');
  if (!canvas) return;
  const dados = [
    estado.operacoes.filter(o => o.tipo === 'WIN').length,
    estado.operacoes.filter(o => o.tipo === 'LOSS').length,
    estado.operacoes.filter(o => o.tipo === 'EMPATE').length
  ];
  if (chartPizzaTipo) {
    chartPizzaTipo.data.datasets[0].data = dados;
    chartPizzaTipo.update('none');
    return;
  }
  chartPizzaTipo = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Loss', 'Empates'],
      datasets: [{
        data: dados,
        backgroundColor: [COR_VERDE, COR_VERMELHO, COR_AMARELO],
        borderColor: COR_FUNDO, borderWidth: 3, hoverOffset: 8
      }]
    },
    options: {
      ...optsBase(),
      cutout: '60%',
      plugins: {
        ...optsBase().plugins,
        legend: { position: 'bottom', labels: { color: COR_TEXTO, font: { size: 11, weight: '600' }, padding: 12, usePointStyle: true } },
        tooltip: {
          ...optsBase().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const p = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${ctx.parsed} (${p}%)`;
            }
          }
        }
      }
    }
  });
}

function renderizarDiaSemana() {
  const canvas = document.getElementById('graficoDiaSemana');
  if (!canvas) return;
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const valores = [0, 0, 0, 0, 0, 0, 0];
  estado.operacoes.forEach(o => {
    const d = new Date(o.data + 'T00:00');
    valores[d.getDay()] += o.valor;
  });
  const cores = valores.map(v => v >= 0 ? COR_VERDE : COR_VERMELHO);
  if (chartDiaSemana) {
    chartDiaSemana.data.datasets[0].data = valores;
    chartDiaSemana.data.datasets[0].backgroundColor = cores;
    chartDiaSemana.update('none');
    return;
  }
  chartDiaSemana = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: dias, datasets: [{ data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }] },
    options: {
      ...optsBase(),
      plugins: { ...optsBase().plugins, legend: { display: false }, tooltip: { ...optsBase().plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 11 } } },
        y: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

function renderizarKelly() {
  const canvas = document.getElementById('graficoKelly');
  if (!canvas) return;
  const k = calcularKelly();
  const dados = [k.kelly, Math.max(0, 100 - k.kelly)];
  if (chartKelly) {
    chartKelly.data.datasets[0].data = dados;
    chartKelly.update('none');
    return;
  }
  chartKelly = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Kelly', 'Restante'],
      datasets: [{ data: dados, backgroundColor: [COR_AZUL_CLARO, COR_GRID], borderColor: 'transparent', borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      ...optsBase(),
      cutout: '75%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderizarDrawdown() {
  const canvas = document.getElementById('graficoDrawdown');
  if (!canvas) return;
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial;
  let topo = saldo;
  const labels = ['Início'];
  const valores = [0];
  ops.forEach(o => {
    saldo += o.valor;
    if (saldo > topo) topo = saldo;
    const dd = topo > 0 ? -((topo - saldo) / topo) * 100 : 0;
    labels.push(new Date(o.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(dd);
  });
  if (chartDrawdown) {
    chartDrawdown.data.labels = labels;
    chartDrawdown.data.datasets[0].data = valores;
    chartDrawdown.update('none');
    return;
  }
  chartDrawdown = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Drawdown %', data: valores,
        borderColor: COR_VERMELHO,
        backgroundColor: 'rgba(255, 59, 85, 0.15)',
        borderWidth: 2, fill: true, tension: 0.4,
        pointBackgroundColor: COR_VERMELHO, pointRadius: 0, pointHoverRadius: 5
      }]
    },
    options: {
      ...optsBase(),
      plugins: { ...optsBase().plugins, legend: { display: false }, tooltip: { ...optsBase().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)}%` } } },
      scales: {
        x: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        y: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => v.toFixed(0) + '%' } }
      }
    }
  });
}

function renderizarSharpe() {
  const canvas = document.getElementById('graficoSharpe');
  if (!canvas) return;
  const s = calcularSharpe();
  const valor = Math.max(0, Math.min(3, s.sharpe));
  const perc = (valor / 3) * 100;
  const dados = [perc, 100 - perc];
  if (chartSharpe) {
    chartSharpe.data.datasets[0].data = dados;
    chartSharpe.update('none');
    return;
  }
  chartSharpe = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Sharpe', 'Restante'],
      datasets: [{ data: dados, backgroundColor: [COR_VERDE, COR_GRID], borderColor: 'transparent', borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      ...optsBase(),
      cutout: '75%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderizarGanhoPerda() {
  const canvas = document.getElementById('graficoGanhoPerda');
  if (!canvas) return;
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN');
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS');
  const ganhoMedio = wins.length > 0 ? wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length : 0;
  const perdaMedia = losses.length > 0 ? losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length : 0;
  const dados = [ganhoMedio, perdaMedia];
  if (chartGanhoPerda) {
    chartGanhoPerda.data.datasets[0].data = dados;
    chartGanhoPerda.update('none');
    return;
  }
  chartGanhoPerda = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Ganho', 'Perda'],
      datasets: [{ data: dados, backgroundColor: [COR_VERDE, COR_VERMELHO], borderRadius: 6, borderSkipped: false }]
    },
    options: {
      ...optsBase(),
      indexAxis: 'y',
      plugins: { ...optsBase().plugins, legend: { display: false }, tooltip: { ...optsBase().plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.x) } } },
      scales: {
        x: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } },
        y: { grid: { display: false, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 12, weight: '600' } } }
      }
    }
  });
}

function renderizarAtivo() {
  const canvas = document.getElementById('graficoAtivo');
  if (!canvas) return;
  const ativos = {};
  estado.operacoes.forEach(o => {
    const ativo = o.ativo && o.ativo.trim() ? o.ativo.trim() : 'Sem ativo';
    if (!ativos[ativo]) ativos[ativo] = 0;
    ativos[ativo] += o.valor;
  });
  const labels = Object.keys(ativos);
  const valores = labels.map(a => ativos[a]);
  const cores = [COR_AZUL, COR_AZUL_CLARO, COR_AZUL_ESCURO, COR_VERDE, COR_AMARELO, '#7B61FF', '#FF9800', '#4CAF50'];
  const bgCores = labels.map((_, i) => cores[i % cores.length]);
  if (chartAtivo) {
    chartAtivo.data.labels = labels;
    chartAtivo.data.datasets[0].data = valores;
    chartAtivo.data.datasets[0].backgroundColor = bgCores;
    chartAtivo.update('none');
    return;
  }
  chartAtivo = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Sem dados'],
      datasets: [{ data: valores.length ? valores : [1], backgroundColor: bgCores, borderColor: COR_FUNDO, borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      ...optsBase(),
      cutout: '60%',
      plugins: {
        ...optsBase().plugins,
        legend: { position: 'bottom', labels: { color: COR_TEXTO, font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: {
          ...optsBase().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s, v) => s + Math.abs(v), 0);
              const p = total > 0 ? ((Math.abs(ctx.parsed) / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${fmtMoeda(ctx.parsed)} (${p}%)`;
            }
          }
        }
      }
    }
  });
}

function renderizarMes() {
  const canvas = document.getElementById('graficoMes');
  if (!canvas) return;
  const meses = {};
  estado.operacoes.forEach(o => {
    const mes = o.data.slice(0, 7);
    if (!meses[mes]) meses[mes] = 0;
    meses[mes] += o.valor;
  });
  const chaves = Object.keys(meses).sort().slice(-6);
  const labels = chaves.map(m => m.split('-').reverse().join('/'));
  const valores = chaves.map(m => meses[m]);
  const cores = valores.map(v => v >= 0 ? COR_VERDE : COR_VERMELHO);
  if (chartMes) {
    chartMes.data.labels = labels;
    chartMes.data.datasets[0].data = valores;
    chartMes.data.datasets[0].backgroundColor = cores;
    chartMes.update('none');
    return;
  }
  chartMes = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }] },
    options: {
      ...optsBase(),
      plugins: { ...optsBase().plugins, legend: { display: false }, tooltip: { ...optsBase().plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 11 } } },
        y: { grid: { color: COR_GRID, drawBorder: false }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

function renderizarTodosGraficos() {
  if (typeof Chart === 'undefined') return;
  renderizarPizzaTipo();
  renderizarDiaSemana();
  renderizarKelly();
  renderizarDrawdown();
  renderizarSharpe();
  renderizarGanhoPerda();
  renderizarAtivo();
  renderizarMes();
}

function renderizarAssertividadeRosca() {
  const canvas = document.getElementById('graficoAssertividadeRosca');
  if (!canvas || typeof Chart === 'undefined') return;
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN').length;
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS').length;
  const total = wins + losses;
  const percentual = total > 0 ? (wins / total) * 100 : 0;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('assertividadePercentualCentro', percentual.toFixed(1) + '%');
  set('assertividadeContadorCentro', `${wins}W · ${losses}L`);
  set('roscaInfoBase', `Baseado em ${total} operações`);

  const barraProg = document.getElementById('roscaBarraProgresso');
  if (barraProg) barraProg.style.width = percentual + '%';

  const dados = total === 0 ? [1, 0] : [wins, losses];
  const cores = total === 0 ? [COR_GRID, COR_GRID] : [COR_VERDE, COR_VERMELHO];

  if (chartRosca) {
    chartRosca.data.datasets[0].data = dados;
    chartRosca.data.datasets[0].backgroundColor = cores;
    chartRosca.update('none');
    return;
  }

  chartRosca = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: total === 0 ? ['Sem dados'] : ['Wins', 'Loss'],
      datasets: [{ data: dados, backgroundColor: cores, borderColor: 'transparent', borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '78%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...optsBase().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              if (total === 0) return 'Sem operações';
              const p = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${p}%)`;
            }
          }
        }
      }
    }
  });
}

// ==================== PDF ====================
function gerarRelatorioPDF() {
  const hoje = new Date();
  const mesAno = hoje.toISOString().slice(0, 7);
  const ops = estado.operacoes.filter(o => o.data.startsWith(mesAno));
  const wins = ops.filter(o => o.tipo === 'WIN');
  const losses = ops.filter(o => o.tipo === 'LOSS');
  const empates = ops.filter(o => o.tipo === 'EMPATE');
  const banca = bancaAtual();
  const resultado = ops.reduce((s, o) => s + o.valor, 0);
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  set('relatorioPeriodo', `${nomesMes[hoje.getMonth()]} de ${hoje.getFullYear()}`);
  set('relatorioSaldo', formatarMoeda(banca));
  set('relatorioResultado', formatarMoeda(resultado));
  set('relatorioAssert', ops.length > 0 ? ((wins.length / (wins.length + losses.length || 1)) * 100).toFixed(1) + '%' : '0%');
  set('relatorioOps', ops.length);
  set('relatorioWins', wins.length);
  set('relatorioLoss', losses.length);
  set('relatorioEmpates', empates.length);
  if (ops.length > 0) {
    set('relatorioMelhor', formatarMoeda(Math.max(...ops.map(o => o.valor))));
    set('relatorioPior', formatarMoeda(Math.min(...ops.map(o => o.valor))));
  } else {
    set('relatorioMelhor', 'R$ 0,00');
    set('relatorioPior', 'R$ 0,00');
  }
  const payoff = calcularPayoff();
  const exp = calcularExpectancia();
  const fator = calcularFatorLucro();
  set('relatorioPayoff', payoff.payoff.toFixed(2));
  set('relatorioExpect', formatarMoeda(exp.expect));
  set('relatorioFator', fator.fator.toFixed(2));

  const corpo = document.getElementById('relatorioOpsCorpo');
  if (corpo) {
    corpo.innerHTML = '';
    ops.slice().reverse().forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.data.split('-').reverse().join('/')}</td>
        <td>${o.hora || '-'}</td>
        <td>${o.ativo || '-'}</td>
        <td style="color: ${o.tipo === 'WIN' ? '#00C98B' : o.tipo === 'LOSS' ? '#FF3B55' : '#FFB547'}; font-weight: 700;">${o.tipo}</td>
        <td style="text-align: right; font-weight: 700;">${formatarMoeda(o.valor)}</td>
      `;
      corpo.appendChild(tr);
    });
  }
  const dataEl = document.getElementById('relatorioData');
  if (dataEl) dataEl.textContent = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('relatorioPDF').style.display = 'block';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.fecharRelatorioPDF = function() {
  document.getElementById('relatorioPDF').style.display = 'none';
};

// ==================== COMPARTILHAR ====================
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function gerarCardCompartilhar(periodo) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#061332');
  grad.addColorStop(1, '#050B27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#0066FF';
  ctx.fillRect(0, 0, 1080, 6);

  ctx.fillStyle = '#1597FF';
  ctx.font = 'bold 52px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FerrTrading', 540, 160);

  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  const titulos = { dia: 'RESULTADO DE HOJE', semana: 'RESULTADO DA SEMANA', mes: 'RESULTADO DO MÊS' };
  ctx.fillText(titulos[periodo] || 'RESULTADO', 540, 230);

  let ops = [];
  const hoje = new Date();
  if (periodo === 'dia') {
    ops = estado.operacoes.filter(o => o.data === hoje.toISOString().split('T')[0]);
  } else if (periodo === 'semana') {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - hoje.getDay());
    inicio.setHours(0, 0, 0, 0);
    ops = estado.operacoes.filter(o => new Date(o.data + 'T00:00') >= inicio);
  } else if (periodo === 'mes') {
    ops = estado.operacoes.filter(o => o.data.startsWith(hoje.toISOString().slice(0, 7)));
  }
  const resultado = ops.reduce((s, o) => s + o.valor, 0);
  const wins = ops.filter(o => o.tipo === 'WIN').length;
  const losses = ops.filter(o => o.tipo === 'LOSS').length;

  ctx.shadowColor = resultado >= 0 ? 'rgba(0, 201, 139, 0.6)' : 'rgba(255, 59, 85, 0.6)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = resultado >= 0 ? '#00C98B' : '#FF3B55';
  ctx.font = 'bold 140px Inter, sans-serif';
  ctx.fillText(resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 540, 500);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0A1738';
  ctx.strokeStyle = '#102653';
  ctx.lineWidth = 2;

  ctx.beginPath();
  roundRect(ctx, 120, 780, 400, 220, 24);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00C98B';
  ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(wins, 320, 900);
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('WINS', 320, 960);

  ctx.fillStyle = '#0A1738';
  ctx.beginPath();
  roundRect(ctx, 560, 780, 400, 220, 24);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FF3B55';
  ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(losses, 760, 900);
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('LOSS', 760, 960);

  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('SALDO ATUAL', 540, 1150);
  ctx.fillStyle = '#F5F7FF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(formatarMoeda(bancaAtual()), 540, 1250);

  const t = wins + losses;
  const taxa = t > 0 ? ((wins / t) * 100).toFixed(0) : 0;
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('ASSERTIVIDADE', 540, 1400);
  ctx.fillStyle = '#1597FF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(taxa + '%', 540, 1500);

  ctx.fillStyle = '#0066FF';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('groupferr.github.io/ferrtrading', 540, 1750);
  ctx.fillStyle = '#5A6B8C';
  ctx.font = '500 26px Inter, sans-serif';
  ctx.fillText('Gerencie sua banca com segurança', 540, 1800);

  return canvas;
}

// ==================== CSV ====================
function exportarCSV() {
  if (estado.operacoes.length === 0) return toast('Sem operações para exportar', 'erro');
  let csv = 'Data,Hora,Ativo,Tipo,Valor\n';
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  ops.forEach(o => {
    csv += `${o.data},${o.hora || ''},${o.ativo || ''},${o.tipo},${o.valor.toFixed(2).replace('.', ',')}\n`;
  });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ferrtrading-operacoes-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('📤 CSV exportado!', 'sucesso');
}

// ==================== RESET ====================
async function resetarDados() {
  estado = {
    bancaInicial: 0,
    operacoes: [], depositos: [], saques: [],
    percentualEntrada: 1, ocultarValores: false, metaMensal: 0,
    ativos: ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'],
    ativoSelecionado: null,
    mesCalendario: new Date().getMonth(),
    anoCalendario: new Date().getFullYear(),
    membroDesde: new Date().toISOString()
  };
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  if (window.__fb && window.__fb.auth.currentUser) {
    const { auth, db, doc, setDoc } = window.__fb;
    try {
      await setDoc(doc(db, 'usuarios', auth.currentUser.uid), estado);
      console.log('☁️ Nuvem limpa');
    } catch (e) { console.error('Erro ao limpar nuvem:', e); }
  }
  syncAtivo = false;
  document.getElementById('modalResetar').style.display = 'none';
  renderizarDropdownAtivos();
  atualizarTextoAtivo();
  toast('🗑️ Dados resetados!', 'sucesso');
  setTimeout(() => { syncAtivo = true; renderizar(); }, 500);
}

// ==================== LOGIN ====================
function inicializarLogin() {
  console.log('🔐 Carregando handlers de login...');
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const form = tab.dataset.form;
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
      const formEl = document.getElementById('form' + (form === 'entrar' ? 'Entrar' : 'Criar'));
      if (formEl) formEl.classList.add('active');
    });
  });

  const formEntrar = document.getElementById('formEntrar');
  if (formEntrar) formEntrar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const erro = document.getElementById('erroEntrar');
    if (erro) erro.textContent = '';
    if (!window.__fb) { if (erro) erro.textContent = 'Firebase carregando...'; return; }
    try {
      const { auth, signInWithEmailAndPassword } = window.__fb;
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'E-mail não cadastrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-email': 'E-mail inválido',
        'auth/invalid-credential': 'E-mail ou senha incorretos'
      };
      if (erro) erro.textContent = msgs[err.code] || 'Erro ao entrar';
    }
  });

  const formCriar = document.getElementById('formCriar');
  if (formCriar) formCriar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('criarEmail').value;
    const senha = document.getElementById('criarSenha').value;
    const senha2 = document.getElementById('criarSenha2').value;
    const erro = document.getElementById('erroCriar');
    if (erro) erro.textContent = '';
    if (senha !== senha2) { if (erro) erro.textContent = 'As senhas não coincidem'; return; }
    if (!window.__fb) { if (erro) erro.textContent = 'Firebase carregando...'; return; }
    try {
      const { auth, createUserWithEmailAndPassword } = window.__fb;
      await createUserWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'E-mail já cadastrado',
        'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres)',
        'auth/invalid-email': 'E-mail inválido'
      };
      if (erro) erro.textContent = msgs[err.code] || 'Erro ao criar conta';
    }
  });

  const btnSair = document.getElementById('btnSair');
  if (btnSair) btnSair.addEventListener('click', async () => {
    if (!confirm('Sair da conta?')) return;
    if (!window.__fb) return;
    const { auth, signOut } = window.__fb;
    await signOut(auth);
    location.reload();
  });
}

// ==================== PWA ====================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstalarPWA');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  toast('🎉 FerrTrading instalado!', 'sucesso');
  const btn = document.getElementById('btnInstalarPWA');
  if (btn) btn.style.display = 'none';
});

// ==================== HELPER ABAS ====================
window.mudarAba = function(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
  if (tab === 'perfil') renderizarPerfil();
  setTimeout(() => {
    [chartLinha, chartBarras, chartRosca, chartPizzaTipo, chartDiaSemana,
     chartKelly, chartDrawdown, chartSharpe, chartGanhoPerda, chartAtivo,
     chartMes, chartMetaMensal].forEach(c => c && c.resize());
  }, 100);
};

// ==================== ANALISTA IA — BINANCE WEBSOCKET ====================
let binanceSocket = null;
let binanceAtivos = [];
let binancePrices = {};

const ATIVO_PARA_PAR = {
  'BITCOIN': 'BTCUSDT',
  'LITECOIN': 'LTCUSDT',
  'CARDANO': 'ADAUSDT',
  'BNB': 'BNBUSDT',
  'ETHEREUM': 'ETHUSDT',
  'SOLANA': 'SOLUSDT',
  'AVAX': 'AVAXUSDT',
  'DOGE': 'DOGEUSDT',
  'SUI': 'SUIUSDT',
  'XPL': 'XPLUSDT',
  'STELLAR': 'XLMUSDT',
  'XRP': 'XRPUSDT',
  'POLKADOT': 'DOTUSDT',
  'CHAINLINK': 'LINKUSDT',
  'MATIC': 'MATICUSDT',
  'TRON': 'TRXUSDT',
  'SHIBA': 'SHIBUSDT',
  'PEPE': 'PEPEUSDT'
};

function getAtivosMonitorados() {
  if (!estado.ativos || estado.ativos.length === 0) {
    return ['BITCOIN', 'ETHEREUM', 'SOLANA', 'BNB', 'XRP'];
  }
  return estado.ativos.filter(a => ATIVO_PARA_PAR[a]);
}

function conectarBinance() {
  const ativos = getAtivosMonitorados();
  if (ativos.length === 0) { console.warn('⚠️ Nenhum ativo'); return; }

  if (binanceSocket) {
    try { binanceSocket.close(); } catch(e) {}
    binanceSocket = null;
  }

  const streams = ativos.map(a => `${ATIVO_PARA_PAR[a].toLowerCase()}@ticker`).join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  console.log('🔌 Conectando à Binance:', url);
  atualizarStatusAnalista('conectando');

  binanceSocket = new WebSocket(url);

  binanceSocket.onopen = () => {
    console.log('✅ WebSocket Binance conectado!');
    atualizarStatusAnalista('conectado');
    binanceAtivos = ativos;
    renderizarListaAnalista();
  };

  binanceSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const data = msg.data;
      if (!data || !data.s) return;

      binancePrices[data.s] = {
        preco: parseFloat(data.c),
        variacao: parseFloat(data.P),
        volume: parseFloat(data.q),
        alta24h: parseFloat(data.h),
        baixa24h: parseFloat(data.l),
        ultimaAtualizacao: Date.now()
      };

      atualizarLinhaAtivo(data.s);
    } catch(e) { /* ignora */ }
  };

  binanceSocket.onerror = (err) => {
    console.error('❌ Erro WebSocket Binance:', err);
    atualizarStatusAnalista('desconectado');
  };

  binanceSocket.onclose = () => {
    console.log('🔌 WebSocket Binance fechado');
    atualizarStatusAnalista('desconectado');
    const tabAtiva = document.getElementById('tab-analista');
    if (tabAtiva && tabAtiva.classList.contains('active')) {
      setTimeout(() => {
        if (document.getElementById('tab-analista')?.classList.contains('active')) {
          conectarBinance();
        }
      }, 5000);
    }
  };
}

function atualizarStatusAnalista(status) {
  const el = document.getElementById('analistaStatus');
  if (!el) return;
  el.classList.remove('conectado', 'desconectado');
  if (status === 'conectado') {
    el.innerHTML = '<i data-lucide="wifi"></i> Conectado';
    el.classList.add('conectado');
  } else if (status === 'desconectado') {
    el.innerHTML = '<i data-lucide="wifi-off"></i> Desconectado';
    el.classList.add('desconectado');
  } else {
    el.innerHTML = '<i data-lucide="loader"></i> Conectando...';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarListaAnalista() {
  const container = document.getElementById('analistaLista');
  if (!container) return;

  const ativos = getAtivosMonitorados();
  container.innerHTML = '';
  const totalEl = document.getElementById('analistaTotalAtivos');
  if (totalEl) totalEl.textContent = ativos.length;

  ativos.forEach(ativo => {
    const par = ATIVO_PARA_PAR[ativo];
    const linha = document.createElement('div');
    linha.className = 'analista-linha';
    linha.id = `analista-linha-${par}`;
    linha.innerHTML = `
      <div class="analista-ativo">
        <div class="analista-ativo-icon">${ativo.substring(0, 2)}</div>
        <div>
          <div class="analista-ativo-nome">${ativo}</div>
          <div class="analista-ativo-par">${par}</div>
        </div>
      </div>
      <div class="analista-preco" id="analista-preco-${par}">--</div>
      <div class="analista-variacao neutra" id="analista-var-${par}">--</div>
      <div class="analista-volume" id="analista-vol-${par}">--</div>
      <div class="analista-sinal aguardar" id="analista-sinal-${par}">🟡 AGUARDAR</div>
    `;
    container.appendChild(linha);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function atualizarLinhaAtivo(par) {
  const data = binancePrices[par];
  if (!data) return;

  const precoEl = document.getElementById(`analista-preco-${par}`);
  const varEl = document.getElementById(`analista-var-${par}`);
  const volEl = document.getElementById(`analista-vol-${par}`);
  const linhaEl = document.getElementById(`analista-linha-${par}`);
  const sinalEl = document.getElementById(`analista-sinal-${par}`);

  if (precoEl) {
    const precoFormatado = data.preco >= 1 
      ? data.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : data.preco.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    const precoAntigo = parseFloat(precoEl.textContent.replace(/[^\d.-]/g, '').replace(',', '.')) || 0;
    precoEl.textContent = `$ ${precoFormatado}`;
    if (linhaEl && precoAntigo > 0) {
      if (data.preco > precoAntigo) {
        linhaEl.classList.remove('piscou-baixa');
        linhaEl.classList.add('piscou-alta');
      } else if (data.preco < precoAntigo) {
        linhaEl.classList.remove('piscou-alta');
        linhaEl.classList.add('piscou-baixa');
      }
      setTimeout(() => linhaEl.classList.remove('piscou-alta', 'piscou-baixa'), 800);
    }
  }

  if (varEl) {
    const v = data.variacao;
    varEl.className = 'analista-variacao ' + (v > 0 ? 'positiva' : v < 0 ? 'negativa' : 'neutra');
    const icone = v > 0 ? 'trending-up' : v < 0 ? 'trending-down' : 'minus';
    const sinal = v > 0 ? '+' : '';
    varEl.innerHTML = `<i data-lucide="${icone}"></i> ${sinal}${v.toFixed(2)}%`;
  }

  if (volEl) {
    const vol = data.volume;
    const volFormatado = vol >= 1e9 ? `Vol: $${(vol/1e9).toFixed(2)}B`
                       : vol >= 1e6 ? `Vol: $${(vol/1e6).toFixed(2)}M`
                       : vol >= 1e3 ? `Vol: $${(vol/1e3).toFixed(2)}K`
                       : `Vol: $${vol.toFixed(2)}`;
    volEl.textContent = volFormatado;
  }

  if (sinalEl) {
    const sinal = calcularSinal(data);
    sinalEl.className = 'analista-sinal ' + sinal.tipo;
    sinalEl.textContent = sinal.label;
    sinalEl.title = sinal.motivo;
  }

  atualizarContadoresAnalista();
  atualizarMelhorOportunidade();
  
  const tsEl = document.getElementById('analistaUltimaAtualizacao');
  if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('pt-BR');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function atualizarContadoresAnalista() {
  let alta = 0, baixa = 0;
  Object.values(binancePrices).forEach(p => {
    if (p.variacao > 0) alta++;
    else if (p.variacao < 0) baixa++;
  });
  const elAlta = document.getElementById('analistaEmAlta');
  const elBaixa = document.getElementById('analistaEmBaixa');
  if (elAlta) elAlta.textContent = alta;
  if (elBaixa) elBaixa.textContent = baixa;
}

// ==================== CÁLCULO DE SINAL ====================
function calcularSinal(data) {
  const variacao = data.variacao;
  let scoreCompra = 0;
  let scoreVenda = 0;
  const motivos = [];

  if (variacao <= -5) {
    scoreCompra += 3;
    motivos.push('Queda forte (' + variacao.toFixed(1) + '%) → possível reversão');
  } else if (variacao <= -3) {
    scoreCompra += 2;
    motivos.push('Queda moderada (' + variacao.toFixed(1) + '%)');
  } else if (variacao >= 5) {
    scoreVenda += 3;
    motivos.push('Alta forte (+' + variacao.toFixed(1) + '%) → possível correção');
  } else if (variacao >= 3) {
    scoreVenda += 2;
    motivos.push('Alta moderada (+' + variacao.toFixed(1) + '%)');
  }

  if (data.volume > 1e8) motivos.push('Volume alto → movimento confiável');

  const range = data.alta24h - data.baixa24h;
  if (range > 0) {
    const posicao = (data.preco - data.baixa24h) / range;
    if (posicao < 0.2) {
      scoreCompra += 2;
      motivos.push('Preço próximo da mínima 24h');
    } else if (posicao > 0.8) {
      scoreVenda += 2;
      motivos.push('Preço próximo da máxima 24h');
    }
  }

  const diff = scoreCompra - scoreVenda;
  if (diff >= 3) {
    return { tipo: 'compra', label: '🟢 COMPRA', score: scoreCompra, motivo: motivos.join(' · '), confianca: Math.min(95, 50 + scoreCompra * 8) };
  } else if (diff <= -3) {
    return { tipo: 'venda', label: '🔴 VENDA', score: scoreVenda, motivo: motivos.join(' · '), confianca: Math.min(95, 50 + scoreVenda * 8) };
  } else {
    return { tipo: 'aguardar', label: '🟡 AGUARDAR', score: 0, motivo: 'Sem confluência. ' + (motivos.join(' · ') || 'Aguardar.'), confianca: 40 + Math.abs(diff) * 5 };
  }
}

// ==================== MELHOR OPORTUNIDADE ====================
function atualizarMelhorOportunidade() {
  const container = document.getElementById('cardOportunidadeConteudo');
  if (!container) return;

  const analises = Object.keys(binancePrices).map(par => {
    const data = binancePrices[par];
    const sinal = calcularSinal(data);
    return { par, data, sinal };
  });

  const oportunidades = analises.filter(a => a.sinal.tipo !== 'aguardar');
  oportunidades.sort((a, b) => b.sinal.confianca - a.sinal.confianca);

  if (oportunidades.length === 0) {
    container.innerHTML = `<p class="placeholder-texto">Nenhuma oportunidade clara no momento. Aguarde...</p>`;
    return;
  }

  const melhor = oportunidades[0];
  const ativoNome = Object.keys(ATIVO_PARA_PAR).find(k => ATIVO_PARA_PAR[k] === melhor.par) || melhor.par;
  const sinalClass = melhor.sinal.tipo === 'compra' ? '' : melhor.sinal.tipo;

  const preco = melhor.data.preco;
  const isCompra = melhor.sinal.tipo === 'compra';
  const stopPercent = 2;
  const alvoPercent = 4;
  const entrada = preco;
  const stop = isCompra ? preco * (1 - stopPercent / 100) : preco * (1 + stopPercent / 100);
  const alvo = isCompra ? preco * (1 + alvoPercent / 100) : preco * (1 - alvoPercent / 100);

  const formatarPreco = (v) => v >= 1 
    ? '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });

  container.innerHTML = `
    <div class="oportunidade-ativo">
      <div class="oportunidade-ativo-icon ${sinalClass}">${ativoNome.substring(0, 2)}</div>
      <div>
        <div class="oportunidade-ativo-nome">${ativoNome}</div>
        <div class="oportunidade-ativo-par">${melhor.par}</div>
      </div>
    </div>
    <div class="oportunidade-sinal ${sinalClass}">
      <div class="oportunidade-sinal-label">SINAL</div>
      <div class="oportunidade-sinal-valor">${melhor.sinal.label}</div>
    </div>
    <div class="oportunidade-info">
      <div class="oportunidade-info-label">ENTRADA / STOP</div>
      <div class="oportunidade-info-valor">
        ${formatarPreco(entrada)}<br>
        <span style="color:var(--vermelho);font-size:14px;">${formatarPreco(stop)}</span>
      </div>
    </div>
    <div class="oportunidade-info">
      <div class="oportunidade-info-label">ALVO</div>
      <div class="oportunidade-info-valor" style="color:var(--verde);">${formatarPreco(alvo)}</div>
    </div>
    <div class="oportunidade-confianca">
      <div class="oportunidade-info-label">CONFIANÇA ${melhor.sinal.confianca}%</div>
      <div class="oportunidade-confianca-barra">
        <div class="oportunidade-confianca-preenchida" style="width:${melhor.sinal.confianca}%"></div>
      </div>
    </div>
  `;
}

function desconectarBinance() {
  if (binanceSocket) {
    try { binanceSocket.close(); } catch(e) {}
    binanceSocket = null;
    console.log('🔌 WebSocket Binance desconectado');
  }
}

window.conectarBinance = conectarBinance;
window.desconectarBinance = desconectarBinance;
window.renderizarListaAnalista = renderizarListaAnalista;

// ==================== SESSÕES ====================
const SESSOES = {
  asiatica: { nome: 'Sessão Asiática', icon: '🇯🇵', inicio: 21, fim: 4, status: '🟡 Liquidez Média' },
  europeia: { nome: 'Sessão Europeia', icon: '🇪🇺', inicio: 4, fim: 10, status: '🟢 Alta Liquidez — Bom horário' },
  americana: { nome: 'Sessão Americana', icon: '🇺🇸', inicio: 10, fim: 17, status: '🟢🟢 Alta Liquidez — Melhor horário' },
  foraSessao: { nome: 'Fora de Sessão', icon: '🌙', inicio: 17, fim: 21, status: '🔴 Baixa Liquidez — Evite operar' }
};

function getSessaoAtual() {
  const horaBrasilia = parseInt(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  if (horaBrasilia >= 21 || horaBrasilia < 4) return 'asiatica';
  if (horaBrasilia >= 4 && horaBrasilia < 10) return 'europeia';
  if (horaBrasilia >= 10 && horaBrasilia < 17) return 'americana';
  return 'foraSessao';
}

function getProximaSessao(sessaoAtual) {
  const ordem = ['asiatica', 'europeia', 'americana', 'foraSessao'];
  const idx = ordem.indexOf(sessaoAtual);
  const proxima = ordem[(idx + 1) % ordem.length];
  return { nome: SESSOES[proxima].nome, icon: SESSOES[proxima].icon, horario: String(SESSOES[proxima].inicio).padStart(2, '0') + ':00' };
}

function atualizarCardSessao() {
  const card = document.getElementById('cardSessao');
  if (!card) return;

  const sessaoAtual = getSessaoAtual();
  const sessao = SESSOES[sessaoAtual];

  card.classList.remove('asiatica', 'europeia', 'americana', 'fora-sessao');
  card.classList.add(sessaoAtual === 'foraSessao' ? 'fora-sessao' : sessaoAtual);

  const iconEl = document.getElementById('sessaoIcon');
  const nomeEl = document.getElementById('sessaoNome');
  const statusEl = document.getElementById('sessaoStatus');
  const horarioEl = document.getElementById('sessaoHorario');
  const proximaEl = document.getElementById('sessaoProxima');

  if (iconEl) iconEl.textContent = sessao.icon;
  if (nomeEl) nomeEl.textContent = sessao.nome;
  if (statusEl) statusEl.textContent = sessao.status;
  if (horarioEl) horarioEl.textContent = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  if (proximaEl) {
    const proxima = getProximaSessao(sessaoAtual);
    proximaEl.textContent = `${proxima.icon} ${proxima.horario}`;
  }
}

setInterval(atualizarCardSessao, 30000);
window.atualizarCardSessao = atualizarCardSessao;
window.getSessaoAtual = getSessaoAtual;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded — iniciando FerrTrading');
  carregar();
  inicializarDropdownAtivos();
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const el = document.getElementById('tab-' + tab);
      if (el) el.classList.add('active');
      if (tab === 'perfil') renderizarPerfil();
      setTimeout(() => {
        [chartLinha, chartBarras, chartRosca, chartPizzaTipo, chartDiaSemana,
         chartKelly, chartDrawdown, chartSharpe, chartGanhoPerda, chartAtivo,
         chartMes, chartMetaMensal].forEach(c => c && c.resize());
      }, 100);
    });
  });

  const btnPerfil = document.getElementById('btnPerfil');
  if (btnPerfil) btnPerfil.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const el = document.getElementById('tab-perfil');
    if (el) el.classList.add('active');
    renderizarPerfil();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  const btnAnalistaIA = document.getElementById('btnAnalistaIA');
  if (btnAnalistaIA) btnAnalistaIA.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const el = document.getElementById('tab-analista');
    if (el) el.classList.add('active');
    if (typeof conectarBinance === 'function') conectarBinance();
    if (typeof atualizarCardSessao === 'function') atualizarCardSessao();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  const btnAnalistaReconectar = document.getElementById('btnAnalistaReconectar');
  if (btnAnalistaReconectar) btnAnalistaReconectar.addEventListener('click', () => {
    conectarBinance();
    toast('🔄 Reconectando à Binance...', 'info', 2000);
  });

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && tab !== 'analista' && typeof desconectarBinance === 'function') {
        desconectarBinance();
      }
    });
  });

  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'mais') { document.getElementById('mobileMenuMais').classList.add('aberto'); return; }
      document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const el = document.getElementById('tab-' + tab);
      if (el) el.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  const btnEnt = document.getElementById('btnAlternarEntrada');
  if (btnEnt) btnEnt.addEventListener('click', () => {
    estado.percentualEntrada = estado.percentualEntrada === 1 ? 10 : 1;
    salvar(); renderizar();
    toast('Entrada alterada para ' + estado.percentualEntrada + '%', 'info', 2000);
  });

  const btnTrocarSenha = document.getElementById('btnTrocarSenha');
  if (btnTrocarSenha) btnTrocarSenha.addEventListener('click', trocarSenha);
  const btnTrocarEmail = document.getElementById('btnTrocarEmail');
  if (btnTrocarEmail) btnTrocarEmail.addEventListener('click', trocarEmail);
  const btnResetarSenhaEmail = document.getElementById('btnResetarSenhaEmail');
  if (btnResetarSenhaEmail) btnResetarSenhaEmail.addEventListener('click', resetarSenhaEmail);
  const btnExportarBackup = document.getElementById('btnExportarBackup');
  if (btnExportarBackup) btnExportarBackup.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ferrtrading-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Backup exportado!', 'sucesso');
  });
  const btnImportarBackup = document.getElementById('btnImportarBackup');
  if (btnImportarBackup) btnImportarBackup.addEventListener('click', () => {
    document.getElementById('inputImportar').click();
  });
  const btnExportarCSVPerfil = document.getElementById('btnExportarCSVPerfil');
  if (btnExportarCSVPerfil) btnExportarCSVPerfil.addEventListener('click', exportarCSV);
  const btnRelatorioPDFPerfil = document.getElementById('btnRelatorioPDFPerfil');
  if (btnRelatorioPDFPerfil) btnRelatorioPDFPerfil.addEventListener('click', gerarRelatorioPDF);
  const btnAnaliseIAPerfil = document.getElementById('btnAnaliseIAPerfil');
  if (btnAnaliseIAPerfil) btnAnaliseIAPerfil.addEventListener('click', analisarComIA);
  const btnCompartilharPerfil = document.getElementById('btnCompartilharPerfil');
  if (btnCompartilharPerfil) btnCompartilharPerfil.addEventListener('click', () => {
    document.getElementById('modalCompartilhar').style.display = 'flex';
  });
  const btnResetarDadosPerfil = document.getElementById('btnResetarDadosPerfil');
  if (btnResetarDadosPerfil) btnResetarDadosPerfil.addEventListener('click', () => {
    document.getElementById('modalResetar').style.display = 'flex';
  });
  const toggleOcultar = document.getElementById('toggleOcultarValores');
  if (toggleOcultar) toggleOcultar.addEventListener('click', () => {
    estado.ocultarValores = !estado.ocultarValores;
    salvar(); renderizar(); renderizarPerfil();
    toast(estado.ocultarValores ? '🔒 Valores ocultos' : '👁️ Visíveis', 'info', 2000);
  });

  const inputImp = document.getElementById('inputImportar');
  if (inputImp) inputImp.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (confirm('Substituir todos os dados atuais?')) {
          estado = { ...estado, ...dados };
          if (!estado.ativos || estado.ativos.length === 0) {
            estado.ativos = ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'];
          }
          salvar();
          renderizarDropdownAtivos();
          atualizarTextoAtivo();
          renderizar();
          toast('📤 Backup importado!', 'sucesso');
        }
      } catch (err) { toast('Arquivo inválido.', 'erro'); }
    };
    reader.readAsText(file);
  });

  const filtro = document.getElementById('filtroMes');
  if (filtro) filtro.addEventListener('change', renderizarHistorico);
  const btnLimpar = document.getElementById('btnLimparFiltro');
  if (btnLimpar) btnLimpar.addEventListener('click', () => {
    document.getElementById('filtroMes').value = '';
    renderizarHistorico();
  });

  const btnAnt = document.getElementById('btnMesAnterior');
  if (btnAnt) btnAnt.addEventListener('click', () => {
    estado.mesCalendario--;
    if (estado.mesCalendario < 0) { estado.mesCalendario = 11; estado.anoCalendario--; }
    salvar(); renderizarCalendario();
  });
  const btnProx = document.getElementById('btnProximoMes');
  if (btnProx) btnProx.addEventListener('click', () => {
    estado.mesCalendario++;
    if (estado.mesCalendario > 11) { estado.mesCalendario = 0; estado.anoCalendario++; }
    salvar(); renderizarCalendario();
  });

  const btnSaq15 = document.getElementById('btnSaqueQuinzenal');
  if (btnSaq15) btnSaq15.addEventListener('click', () => registrarSaque(15));
  const btnSaq30 = document.getElementById('btnSaqueMensal');
  if (btnSaq30) btnSaq30.addEventListener('click', () => registrarSaque(30));

  const btnFecharIA = document.getElementById('btnFecharModalIA');
  if (btnFecharIA) btnFecharIA.addEventListener('click', () => document.getElementById('modalIA').style.display = 'none');
  const btnFecharIA2 = document.getElementById('btnFecharIA2');
  if (btnFecharIA2) btnFecharIA2.addEventListener('click', () => document.getElementById('modalIA').style.display = 'none');
  const btnGerarAnalise = document.getElementById('btnGerarAnalise');
  if (btnGerarAnalise) btnGerarAnalise.addEventListener('click', analisarComIA);

  const modalComp = document.getElementById('modalCompartilhar');
  const btnFecharComp = document.getElementById('btnFecharCompartilhar');
  if (btnFecharComp) btnFecharComp.addEventListener('click', () => { if (modalComp) modalComp.style.display = 'none'; });
  const btnFecharModalComp = document.getElementById('btnFecharModalCompartilhar');
  if (btnFecharModalComp) btnFecharModalComp.addEventListener('click', () => { if (modalComp) modalComp.style.display = 'none'; });

  function atualizarPreviewCard(periodo) {
    const preview = document.getElementById('cardPreview');
    if (!preview) return;
    const canvas = gerarCardCompartilhar(periodo);
    preview.innerHTML = '';
    preview.appendChild(canvas);
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxHeight = '400px';
    canvas.style.borderRadius = '12px';
  }

  document.querySelectorAll('.btn-compartilhar-opcao').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-compartilhar-opcao').forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      atualizarPreviewCard(btn.dataset.periodo);
    });
  });

  const btnBaixarCard = document.getElementById('btnBaixarCard');
  if (btnBaixarCard) btnBaixarCard.addEventListener('click', () => {
    const canvas = document.querySelector('#cardPreview canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'ferrtrading-' + new Date().toISOString().split('T')[0] + '.png';
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast('💾 Imagem baixada!', 'sucesso');
    }, 'image/png');
  });

  const btnEditarMeta = document.getElementById('btnEditarMetaMensal');
  const modalMeta = document.getElementById('modalMetaMensal');
  const btnFecharModalMeta = document.getElementById('btnFecharModalMeta');
  const btnSalvarMeta = document.getElementById('btnSalvarMetaMensal');
  const inputMeta = document.getElementById('inputMetaMensal');
  if (btnEditarMeta) btnEditarMeta.addEventListener('click', () => {
    if (inputMeta) inputMeta.value = estado.metaMensal || '';
    if (modalMeta) modalMeta.style.display = 'flex';
  });
  if (btnFecharModalMeta) btnFecharModalMeta.addEventListener('click', () => { if (modalMeta) modalMeta.style.display = 'none'; });
  if (btnSalvarMeta) btnSalvarMeta.addEventListener('click', () => {
    const valor = parseFloat(inputMeta.value) || 0;
    estado.metaMensal = valor;
    salvar(); renderizar();
    if (modalMeta) modalMeta.style.display = 'none';
    toast(valor > 0 ? '🎯 Meta definida: ' + formatarMoeda(valor) : 'Meta removida', 'sucesso');
  });

  const modalReset = document.getElementById('modalResetar');
  const btnFecharModalReset = document.getElementById('btnFecharModalReset');
  const btnConfirmarReset = document.getElementById('btnConfirmarReset');
  const btnCancelarReset = document.getElementById('btnCancelarReset');
  if (btnFecharModalReset) btnFecharModalReset.addEventListener('click', () => { if (modalReset) modalReset.style.display = 'none'; });
  if (btnCancelarReset) btnCancelarReset.addEventListener('click', () => { if (modalReset) modalReset.style.display = 'none'; });
  if (btnConfirmarReset) btnConfirmarReset.addEventListener('click', resetarDados);

  const btnFecharModalPrint = document.getElementById('btnFecharModalPrint');
  if (btnFecharModalPrint) btnFecharModalPrint.addEventListener('click', () => {
    document.getElementById('modalPrint').style.display = 'none';
  });

  inicializarLogin();
  renderizar();
  console.log('✅ FerrTrading inicializado');
});

console.log('📦 FerrTrading script.js carregado com sucesso');