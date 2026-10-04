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
  anoCalendario: new Date().getFullYear()
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
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  syncAtivo = true;
  renderizarDropdownAtivos();
  renderizar();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  toast('☁️ Dados sincronizados', 'sucesso', 2000);
};

window.enviarDadosPraNuvem = function() {
  syncAtivo = true;
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

function calcularAssertividade(ops) {
  const wins = ops.filter(o => o.tipo === 'WIN').length;
  const losses = ops.filter(o => o.tipo === 'LOSS').length;
  const total = wins + losses;
  if (total === 0) return 0;
  return (wins / total) * 100;
}

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
}// ==================== DROPDOWN DE ATIVOS ====================
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
}

// ==================== RENDERIZAÇÃO PRINCIPAL ====================
function renderizar() {
  const banca = bancaAtual();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAno = hoje.slice(0, 7);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  // Banca + badge de variação
  animarNumero('bancaAtual', banca);
  const badgeSaldo = document.getElementById('badgeSaldo');
  if (badgeSaldo) {
    const resMes = resultadoPeriodo(operacoesDoMes(mesAno));
    const perc = banca > 0 ? (resMes / banca) * 100 : 0;
    badgeSaldo.textContent = (perc >= 0 ? '+' : '') + perc.toFixed(1) + '%';
    badgeSaldo.classList.toggle('negativo', perc < 0);
  }

  // Entrada
  const entrada = banca * (estado.percentualEntrada / 100);
  set('entradaSugerida', formatarMoeda(entrada));
  set('percentualEntrada', estado.percentualEntrada + '% do saldo');

  // Meta do dia + Stop
  const ms = calcularMetaStop();
  set('metaDia', formatarMoeda(ms.metaValor));
  set('metaInfo', `${ms.metaPercentual}% do saldo · ${ms.winsHoje} wins hoje`);
  set('stopDia', formatarMoeda(ms.stopValor));
  set('stopInfo', `${ms.stopPercentual}% · ${ms.winsHoje > 20 ? '10% (dia excepcional)' : '5% padrão'}`);

  const alerta = document.getElementById('alertaStop');
  if (alerta) alerta.style.display = (ms.resultadoHoje < 0 && Math.abs(ms.resultadoHoje) >= ms.stopValor) ? 'flex' : 'none';

  // Contador do dia
  const opsDia = operacoesDoDia(hoje);
  const contDia = contarPorTipo(opsDia);
  set('winsHoje', contDia.wins);
  set('lossHoje', contDia.losses);
  set('empatesHoje', contDia.empates);

  // Sequências
  const seq = calcularSequencias();
  const seqEl = document.getElementById('seqAtual');
  if (seqEl) {
    if (seq.seqTipo === 'WIN') { seqEl.textContent = seq.seqAtual + ' wins'; seqEl.style.color = '#00C98B'; }
    else if (seq.seqTipo === 'LOSS') { seqEl.textContent = seq.seqAtual + ' loss'; seqEl.style.color = '#FF3B55'; }
    else { seqEl.textContent = '-'; seqEl.style.color = ''; }
  }
  set('seqMaxWins', 'Máx: ' + seq.maxWins);
  set('seqMaxLoss', seq.maxLoss);

  // Meta mensal (estilo Referral Tracking)
  const mm = calcularMetaMensal();
  set('metaMensalResultado', formatarMoeda(mm.resultadoMes));
  set('metaMensalFalta', formatarMoeda(Math.max(0, mm.meta - mm.resultadoMes)));
  set('metaMensalPercentual', mm.percentual.toFixed(1) + '%');

  // Boas-vindas
  const bvSub = document.getElementById('boasVindasSub');
  if (bvSub) {
    bvSub.textContent = `Sua banca está em ${formatarMoeda(banca)}.`;
  }

  // Saque
  renderizarSaque(banca);

  // Últimas operações
  renderizarUltimasOperacoes();

  // Histórico, tabelas, gráficos
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

  // Data atual
  const dataEl = document.getElementById('dataAtual');
  if (dataEl) {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', opcoes);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
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
    const temPrint = o.print ? `<button class="btn-ver-print-vision" onclick="verPrint('${o.id}')"><i data-lucide="image"></i> Ver</button>` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.ativo || '-'}</td>
      <td>${o.data.split('-').reverse().join('/')}</td>
      <td>${o.hora || '-'}</td>
      <td><span class="badge-tabela ${tipoClass}">${o.tipo}</span></td>
      <td class="${tipoClass}">${formatarMoeda(o.valor)}</td>
      <td>
        ${temPrint}
        <button class="btn-remover-vision" onclick="removerOperacao('${o.id}')"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    corpo.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.verPrint = function(id) {
  const op = estado.operacoes.find(o => String(o.id) === String(id));
  if (!op || !op.print) return;
  const modal = document.getElementById('modalPrint');
  const img = document.getElementById('modalPrintImg');
  if (img) img.src = op.print;
  if (modal) modal.style.display = 'flex';
};

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

// ==================== GRÁFICO META MENSAL (rosca) ====================
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

// ==================== GRÁFICO LINHA ====================
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

// ==================== GRÁFICO BARRAS ====================
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

// ==================== PIZZA / ROSCA ====================
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
    tipo, ativo, valor: valorFinal, data, hora,
    print: window.printAtual || null
  });

  if (window.printAtual) {
    window.printAtual = null;
    const preview = document.getElementById('printPreview');
    if (preview) preview.style.display = 'none';
    const inpCam = document.getElementById('inputPrintCamera');
    const inpGal = document.getElementById('inputPrintGaleria');
    if (inpCam) inpCam.value = '';
    if (inpGal) inpGal.value = '';
  }

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
  const saquesMesmoTipo = estado.saques.filter(s => s.tipo === tipo);
  let aviso = '';

  if (saquesMesmoTipo.length > 0) {
    const ultimo = saquesMesmoTipo[saquesMesmoTipo.length - 1];
    const dataUltimo = new Date(ultimo.data + 'T00:00');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diasPassados = Math.floor((hoje - dataUltimo) / (1000 * 60 * 60 * 24));
    const diasNecessarios = percentual === 15 ? 15 : 30;
    if (diasPassados < diasNecessarios) {
      aviso = `\n\n⚠️ Você sacou ${tipo} há ${diasPassados} dia(s).\nO ideal é esperar ${diasNecessarios} dias.\nDeseja continuar mesmo assim?`;
    }
  }

  const valor = banca * (percentual / 100);
  if (!confirm('Registrar saque ' + percentual + '% (' + tipo + ')?\n\nSaldo: ' + formatarMoeda(banca) + '\nSaque: ' + formatarMoeda(valor) + aviso)) return;

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
}

// ==================== PRINT ====================
window.printAtual = null;

function processarPrint(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx. 2MB)', 'erro'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    window.printAtual = e.target.result;
    const preview = document.getElementById('printPreview');
    const img = document.getElementById('printPreviewImg');
    if (preview) preview.style.display = 'block';
    if (img) img.src = window.printAtual;
    toast('📸 Print anexado!', 'sucesso', 2000);
  };
  reader.readAsDataURL(file);
}

// ==================== PIN ====================
let pinDigitado = '';
let pinSetupModo = false;
let pinSetupTemp = '';

function atualizarPinDisplay() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => {
    d.classList.remove('preenchido', 'erro');
    if (i < pinDigitado.length) d.classList.add('preenchido');
  });
  const err = document.getElementById('pinErro');
  if (err) err.textContent = pinSetupModo ? 'Defina um PIN de 4 dígitos' : '';
}

function verificarPin() {
  const pinSalvo = localStorage.getItem('ferrTradingPIN');
  if (pinDigitado === pinSalvo) {
    window.__pinLiberado = true;
    document.getElementById('telaPin').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    renderizar();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    toast('🔓 Bem-vindo!', 'sucesso', 2000);
  } else {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(d => d.classList.add('erro'));
    const err = document.getElementById('pinErro');
    if (err) err.textContent = 'PIN incorreto';
    setTimeout(() => { pinDigitado = ''; atualizarPinDisplay(); }, 500);
  }
}

function configurarPin() {
  if (pinSetupTemp === '') {
    pinSetupTemp = pinDigitado;
    pinDigitado = '';
    atualizarPinDisplay();
    const err = document.getElementById('pinErro');
    if (err) err.textContent = 'Confirme o PIN';
  } else {
    if (pinSetupTemp === pinDigitado) {
      localStorage.setItem('ferrTradingPIN', pinDigitado);
      window.__pinLiberado = true;
      document.getElementById('telaPin').style.display = 'none';
      document.getElementById('appWrapper').style.display = 'block';
      renderizar();
      toast('🔐 PIN configurado!', 'sucesso', 2000);
    } else {
      const err = document.getElementById('pinErro');
      if (err) err.textContent = 'PINs não coincidem. Tente de novo.';
      pinDigitado = '';
      pinSetupTemp = '';
      setTimeout(atualizarPinDisplay, 1000);
    }
  }
}

// ==================== IA ====================
function gerarTextoIA() {
  const banca = bancaAtual();
  const ops = estado.operacoes;
  if (ops.length === 0) return 'Ainda não tenho operações registradas para analisar.';
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

// ==================== COMPARTILHAR (card 9:16) ====================
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
  // Fundo gradiente Vision UI
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#061332');
  grad.addColorStop(1, '#050B27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);
  // Barra azul no topo
  ctx.fillStyle = '#0066FF';
  ctx.fillRect(0, 0, 1080, 6);

  // Título
  ctx.fillStyle = '#1597FF';
  ctx.font = 'bold 52px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FerrTrading', 540, 160);

  // Subtítulo
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  const titulos = { dia: 'RESULTADO DE HOJE', semana: 'RESULTADO DA SEMANA', mes: 'RESULTADO DO MÊS' };
  ctx.fillText(titulos[periodo] || 'RESULTADO', 540, 230);

  // Filtra operações
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

  // Resultado gigante com glow
  ctx.shadowColor = resultado >= 0 ? 'rgba(0, 201, 139, 0.6)' : 'rgba(255, 59, 85, 0.6)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = resultado >= 0 ? '#00C98B' : '#FF3B55';
  ctx.font = 'bold 140px Inter, sans-serif';
  ctx.fillText(resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 540, 500);
  ctx.shadowBlur = 0;

  // Cards de wins/loss
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

  // Saldo
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('SALDO ATUAL', 540, 1150);
  ctx.fillStyle = '#F5F7FF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(formatarMoeda(bancaAtual()), 540, 1250);

  // Assertividade
  const t = wins + losses;
  const taxa = t > 0 ? ((wins / t) * 100).toFixed(0) : 0;
  ctx.fillStyle = '#8B9BC2';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('ASSERTIVIDADE', 540, 1400);
  ctx.fillStyle = '#1597FF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(taxa + '%', 540, 1500);

  // Rodapé
  ctx.fillStyle = '#0066FF';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('ferrtrading.com', 540, 1750);
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
    anoCalendario: new Date().getFullYear()
  };
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  localStorage.removeItem('ferrTradingPIN');
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
    window.__pinLiberado = false;
    const { auth, signOut } = window.__fb;
    await signOut(auth);
    location.reload();
  });

  const mmSair = document.getElementById('mmSair');
  if (mmSair) mmSair.addEventListener('click', async () => {
    if (!confirm('Sair da conta?')) return;
    if (!window.__fb) return;
    window.__pinLiberado = false;
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
  setTimeout(() => {
    [chartLinha, chartBarras, chartRosca, chartPizzaTipo, chartDiaSemana,
     chartKelly, chartDrawdown, chartSharpe, chartGanhoPerda, chartAtivo,
     chartMes, chartMetaMensal].forEach(c => c && c.resize());
  }, 100);
};

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
      setTimeout(() => {
        [chartLinha, chartBarras, chartRosca, chartPizzaTipo, chartDiaSemana,
         chartKelly, chartDrawdown, chartSharpe, chartGanhoPerda, chartAtivo,
         chartMes, chartMetaMensal].forEach(c => c && c.resize());
      }, 100);
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
      setTimeout(() => {
        [chartLinha, chartBarras, chartRosca].forEach(c => c && c.resize());
      }, 100);
    });
  });

  document.querySelectorAll('.mm-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const el = document.getElementById('tab-' + tab);
      if (el) el.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.getElementById('mobileMenuMais').classList.remove('aberto');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        [chartLinha, chartBarras, chartRosca].forEach(c => c && c.resize());
      }, 100);
    });
  });

  const overlay = document.querySelector('.mm-overlay');
  if (overlay) overlay.addEventListener('click', () => {
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const btnEnt = document.getElementById('btnAlternarEntrada');
  if (btnEnt) btnEnt.addEventListener('click', () => {
    estado.percentualEntrada = estado.percentualEntrada === 1 ? 10 : 1;
    salvar(); renderizar();
    toast('Entrada alterada para ' + estado.percentualEntrada + '%', 'info', 2000);
  });

  const btnOc = document.getElementById('btnOcultar');
  if (btnOc) btnOc.addEventListener('click', () => {
    estado.ocultarValores = !estado.ocultarValores;
    salvar(); renderizar();
    toast(estado.ocultarValores ? '🔒 Valores ocultos' : '👁️ Visíveis', 'info', 2000);
  });

  const btnExp = document.getElementById('btnExportar');
  if (btnExp) btnExp.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ferrtrading-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Backup exportado!', 'sucesso');
  });

  const btnImp = document.getElementById('btnImportar');
  if (btnImp) btnImp.addEventListener('click', () => { document.getElementById('inputImportar').click(); });

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

  const btnSaq15 = document.getElementById('btnSaqueQuinzenal');
  if (btnSaq15) btnSaq15.addEventListener('click', () => registrarSaque(15));
  const btnSaq30 = document.getElementById('btnSaqueMensal');
  if (btnSaq30) btnSaq30.addEventListener('click', () => registrarSaque(30));

  const filtro = document.getElementById('filtroMes');
  if (filtro) filtro.addEventListener('change', renderizarHistorico);
  const btnLimpar = document.getElementById('btnLimparFiltro');
  if (btnLimpar) btnLimpar.addEventListener('click', () => {
    document.getElementById('filtroMes').value = '';
    renderizarHistorico();
  });

  const btnCSV = document.getElementById('btnExportarCSV');
  if (btnCSV) btnCSV.addEventListener('click', exportarCSV);
  const btnCSVHist = document.getElementById('btnExportarCSVHistorico');
  if (btnCSVHist) btnCSVHist.addEventListener('click', exportarCSV);

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

  const mmOcultar = document.getElementById('mmOcultar');
  if (mmOcultar) mmOcultar.addEventListener('click', () => {
    estado.ocultarValores = !estado.ocultarValores;
    salvar(); renderizar();
    toast(estado.ocultarValores ? '🔒 Ocultos' : '👁️ Visíveis', 'info', 2000);
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const mmExp = document.getElementById('mmExportar');
  if (mmExp) mmExp.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ferrtrading-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Backup exportado!', 'sucesso');
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const mmImp = document.getElementById('mmImportar');
  if (mmImp) mmImp.addEventListener('click', () => {
    document.getElementById('inputImportar').click();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const btnPWA = document.getElementById('btnInstalarPWA');
  if (btnPWA) btnPWA.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') toast('🎉 App instalado!', 'sucesso');
    deferredPrompt = null;
    btnPWA.style.display = 'none';
  });

  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      if (num === 'C') { pinDigitado = ''; atualizarPinDisplay(); return; }
      if (num === '←') { pinDigitado = pinDigitado.slice(0, -1); atualizarPinDisplay(); return; }
      if (pinDigitado.length < 4) {
        pinDigitado += num;
        atualizarPinDisplay();
        if (pinDigitado.length === 4) {
          setTimeout(() => {
            if (pinSetupModo) configurarPin();
            else verificarPin();
          }, 200);
        }
      }
    });
  });

  const btnEsqueci = document.getElementById('btnEsqueciPin');
  if (btnEsqueci) btnEsqueci.addEventListener('click', () => {
    if (!confirm('Redefinir o PIN?')) return;
    localStorage.removeItem('ferrTradingPIN');
    window.__pinLiberado = true;
    document.getElementById('telaPin').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    renderizar();
    toast('PIN removido.', 'info', 4000);
  });

  function abrirAnaliseIA() {
    const modal = document.getElementById('modalIA');
    const texto = document.getElementById('textoIA');
    if (texto) texto.value = gerarTextoIA();
    if (modal) modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  const btnIA = document.getElementById('btnAnaliseIA');
  if (btnIA) btnIA.addEventListener('click', abrirAnaliseIA);
  const mmIA = document.getElementById('mmAnaliseIA');
  if (mmIA) mmIA.addEventListener('click', () => {
    abrirAnaliseIA();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });
  const btnFecharIA = document.getElementById('btnFecharModalIA');
  if (btnFecharIA) btnFecharIA.addEventListener('click', () => {
    document.getElementById('modalIA').style.display = 'none';
  });
  const btnCopiarIA = document.getElementById('btnCopiarIA');
  if (btnCopiarIA) btnCopiarIA.addEventListener('click', () => {
    const texto = document.getElementById('textoIA');
    if (texto) {
      texto.select();
      document.execCommand('copy');
      toast('📋 Texto copiado!', 'sucesso');
    }
  });

  const btnPDF = document.getElementById('btnRelatorioPDF');
  if (btnPDF) btnPDF.addEventListener('click', gerarRelatorioPDF);
  const mmPDF = document.getElementById('mmRelatorioPDF');
  if (mmPDF) mmPDF.addEventListener('click', () => {
    gerarRelatorioPDF();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const modalComp = document.getElementById('modalCompartilhar');
  const btnComp = document.getElementById('btnCompartilhar');
  const mmComp = document.getElementById('mmCompartilhar');

  function abrirCompartilhar() {
    if (modalComp) modalComp.style.display = 'flex';
    document.querySelectorAll('.btn-compartilhar-opcao').forEach(b => b.classList.remove('ativo'));
    const btnDia = document.querySelector('.btn-compartilhar-opcao[data-periodo="dia"]');
    if (btnDia) {
      btnDia.classList.add('ativo');
      atualizarPreviewCard('dia');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

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

  if (btnComp) btnComp.addEventListener('click', abrirCompartilhar);
  if (mmComp) mmComp.addEventListener('click', () => {
    abrirCompartilhar();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  document.querySelectorAll('.btn-compartilhar-opcao').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-compartilhar-opcao').forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      atualizarPreviewCard(btn.dataset.periodo);
    });
  });

  const btnBaixarCard = document.getElementById('btnBaixarCard');
  if (btnBaixarCard) btnBaixarCard.addEventListener('click', async () => {
    const canvas = document.querySelector('#cardPreview canvas');
    if (!canvas) return;
    const nomeArquivo = 'ferrtrading-' + new Date().toISOString().split('T')[0] + '.png';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    try {
      if (isMobile && navigator.share) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], nomeArquivo, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'FerrTrading', text: 'Meu resultado no FerrTrading' });
            toast('✅ Imagem compartilhada!', 'sucesso');
            return;
          } catch (err) { if (err.name === 'AbortError') return; }
        }
        const dataUrl = canvas.toDataURL('image/png');
        const win = window.open('', '_blank');
        if (win) {
          win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Salvar imagem</title><style>body{margin:0;background:#050B27;color:#fff;font-family:sans-serif;text-align:center;padding:20px}img{max-width:100%;height:auto;border-radius:12px;box-shadow:0 10px 40px rgba(0,102,255,0.3);margin-bottom:20px}p{font-size:14px;color:#1597FF;background:#061332;padding:12px;border-radius:8px}</style></head><body><p>📱 Segure na imagem e escolha <strong>"Salvar imagem"</strong></p><img src="' + dataUrl + '"></body></html>');
          win.document.close();
        }
        return;
      }
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = nomeArquivo;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        toast('💾 Imagem baixada!', 'sucesso');
      }, 'image/png');
    } catch (err) {
      console.error('Erro:', err);
      toast('Erro ao salvar. Tente novamente.', 'erro');
    }
  });

  const btnFecharComp = document.getElementById('btnFecharCompartilhar');
  if (btnFecharComp) btnFecharComp.addEventListener('click', () => {
    if (modalComp) modalComp.style.display = 'none';
  });
  const btnFecharModalComp = document.getElementById('btnFecharModalCompartilhar');
  if (btnFecharModalComp) btnFecharModalComp.addEventListener('click', () => {
    if (modalComp) modalComp.style.display = 'none';
  });

  const btnEditarMeta = document.getElementById('btnEditarMetaMensal');
  const modalMeta = document.getElementById('modalMetaMensal');
  const btnFecharModalMeta = document.getElementById('btnFecharModalMeta');
  const btnSalvarMeta = document.getElementById('btnSalvarMetaMensal');
  const inputMeta = document.getElementById('inputMetaMensal');
  if (btnEditarMeta) btnEditarMeta.addEventListener('click', () => {
    if (inputMeta) inputMeta.value = estado.metaMensal || '';
    if (modalMeta) modalMeta.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
  if (btnFecharModalMeta) btnFecharModalMeta.addEventListener('click', () => {
    if (modalMeta) modalMeta.style.display = 'none';
  });
  if (btnSalvarMeta) btnSalvarMeta.addEventListener('click', () => {
    const valor = parseFloat(inputMeta.value) || 0;
    estado.metaMensal = valor;
    salvar();
    renderizar();
    if (modalMeta) modalMeta.style.display = 'none';
    toast(valor > 0 ? '🎯 Meta definida: ' + formatarMoeda(valor) : 'Meta removida', 'sucesso');
  });

  const btnReset = document.getElementById('btnResetar');
  const mmReset = document.getElementById('mmResetar');
  const modalReset = document.getElementById('modalResetar');
  const btnFecharModalReset = document.getElementById('btnFecharModalReset');
  const btnConfirmarReset = document.getElementById('btnConfirmarReset');
  const btnCancelarReset = document.getElementById('btnCancelarReset');
  function abrirReset() {
    if (modalReset) modalReset.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  if (btnReset) btnReset.addEventListener('click', abrirReset);
  if (mmReset) mmReset.addEventListener('click', () => {
    abrirReset();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });
  if (btnFecharModalReset) btnFecharModalReset.addEventListener('click', () => {
    if (modalReset) modalReset.style.display = 'none';
  });
  if (btnCancelarReset) btnCancelarReset.addEventListener('click', () => {
    if (modalReset) modalReset.style.display = 'none';
  });
  if (btnConfirmarReset) btnConfirmarReset.addEventListener('click', resetarDados);

  inicializarLogin();
  renderizar();
  console.log('✅ FerrTrading inicializado');
});

console.log('📦 FerrTrading script.js carregado com sucesso');