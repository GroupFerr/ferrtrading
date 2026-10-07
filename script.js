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

async function enviarPraNuvem() {
  if (!syncAtivo || !window.__fb) return;
  const { auth, db, doc, setDoc } = window.__fb;
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, 'usuarios', user.uid), estado);
  } catch (e) { console.error('Erro sync:', e); }
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
  if (!estado.membroDesde) { estado.membroDesde = new Date().toISOString(); enviarPraNuvem(); }
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  syncAtivo = true;
  renderizarDropdownAtivos();
  renderizar();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  toast('☁️ Sincronizado', 'sucesso', 2000);
};

window.enviarDadosPraNuvem = function() {
  syncAtivo = true;
  if (!estado.membroDesde) estado.membroDesde = new Date().toISOString();
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

function formatarMoeda(valor) {
  if (estado.ocultarValores) return 'R$ ••••';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPercentual(valor) {
  if (estado.ocultarValores) return '••%';
  return valor.toFixed(1) + '%';
}

function toast(mensagem, tipo = 'info', duracao = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { sucesso: '✅', erro: '❌', info: 'ℹ️', aviso: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast tipo-${tipo}`;
  el.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span class="toast-msg">${mensagem}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, duracao);
}

function animarNumero(id, valorFinal) {
  const el = document.getElementById(id);
  if (!el) return;
  if (estado.ocultarValores) { el.textContent = formatarMoeda(valorFinal); return; }
  const textoAtual = el.textContent.replace(/[^\d,-]/g, '').replace(',', '.');
  const valorAtual = parseFloat(textoAtual) || 0;
  if (Math.abs(valorAtual - valorFinal) < 0.01) { el.textContent = formatarMoeda(valorFinal); return; }
  el.classList.add('numero-animando');
  setTimeout(() => el.classList.remove('numero-animando'), 400);
  const passos = 20;
  const incremento = (valorFinal - valorAtual) / passos;
  let atual = valorAtual, passo = 0;
  const timer = setInterval(() => {
    passo++;
    atual += incremento;
    if (passo >= passos) { atual = valorFinal; clearInterval(timer); }
    el.textContent = formatarMoeda(atual);
  }, 25);
}

function bancaAtual() {
  const totalOp = estado.operacoes.reduce((s, o) => s + o.valor, 0);
  const totalDep = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const totalSaq = estado.saques.reduce((s, x) => s + x.valor, 0);
  return estado.bancaInicial + totalOp + totalDep - totalSaq;
}

function operacoesDoDia(data) { return estado.operacoes.filter(o => o.data === data); }
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
  let seqAtual = 0, seqTipo = null, maxWins = 0, maxLoss = 0, tempW = 0, tempL = 0;
  ops.forEach(o => {
    if (o.tipo === 'WIN') {
      tempW++; tempL = 0; maxWins = Math.max(maxWins, tempW);
      if (seqTipo === 'WIN') seqAtual++; else { seqTipo = 'WIN'; seqAtual = 1; }
    } else if (o.tipo === 'LOSS') {
      tempL++; tempW = 0; maxLoss = Math.max(maxLoss, tempL);
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
    metaValor: banca * (metaPercentual / 100), metaPercentual,
    stopValor: stopFinal === Infinity ? stopBanca : stopFinal,
    stopPercentual, resultadoHoje, winsHoje: wins
  };
}

function calcularKelly() {
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN');
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { kelly: 0, info: 'Precisa wins e losses' };
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  if (perdaMedia === 0) return { kelly: 0, info: 'Sem perdas' };
  const b = ganhoMedio / perdaMedia;
  const p = wins.length / (wins.length + losses.length);
  const q = 1 - p;
  const kelly = ((p * b - q) / b) * 100;
  return { kelly: Math.max(0, kelly), info: `Cheio: ${Math.max(0, kelly).toFixed(1)}%` };
}

function calcularDrawdown() {
  if (estado.operacoes.length === 0) return { maxDD: 0, atualDD: 0, info: 'Sem dados' };
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial, topo = saldo, maxDD = 0, maxDDValor = 0;
  ops.forEach(o => {
    saldo += o.valor;
    if (saldo > topo) topo = saldo;
    const dd = topo > 0 ? ((topo - saldo) / topo) * 100 : 0;
    if (dd > maxDD) { maxDD = dd; maxDDValor = topo - saldo; }
  });
  const ddAtual = topo > 0 ? ((topo - saldo) / topo) * 100 : 0;
  return { maxDD, maxDDValor, atualDD: ddAtual, info: `Atual: ${ddAtual.toFixed(1)}%` };
}

function calcularSharpe() {
  const ops = estado.operacoes;
  if (ops.length < 2) return { sharpe: 0, info: 'Precisa 2+ ops' };
  const retornos = ops.map(o => o.valor);
  const media = retornos.reduce((s, r) => s + r, 0) / retornos.length;
  const variancia = retornos.reduce((s, r) => s + Math.pow(r - media, 2), 0) / retornos.length;
  const desvio = Math.sqrt(variancia);
  if (desvio === 0) return { sharpe: 0, info: 'Sem variação' };
  const sharpe = media / desvio;
  return { sharpe, info: sharpe > 2 ? 'Excelente' : sharpe > 1 ? 'Bom' : sharpe > 0 ? 'Razoável' : 'Ruim' };
}

function calcularPayoff() {
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN');
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { payoff: 0, info: 'Precisa wins e losses' };
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  const payoff = perdaMedia === 0 ? 0 : ganhoMedio / perdaMedia;
  return { payoff, info: payoff > 2 ? 'Excelente' : payoff > 1 ? 'Bom' : 'Melhorar' };
}

function calcularExpectancia() {
  const ops = estado.operacoes;
  if (ops.length === 0) return { expect: 0, info: 'Sem ops' };
  const wins = ops.filter(o => o.tipo === 'WIN');
  const losses = ops.filter(o => o.tipo === 'LOSS');
  if (wins.length === 0 || losses.length === 0) return { expect: 0, info: 'Precisa wins e losses' };
  const taxa = wins.length / (wins.length + losses.length);
  const ganhoMedio = wins.reduce((s, o) => s + Math.abs(o.valor), 0) / wins.length;
  const perdaMedia = losses.reduce((s, o) => s + Math.abs(o.valor), 0) / losses.length;
  const expect = (taxa * ganhoMedio) - ((1 - taxa) * perdaMedia);
  return { expect, info: expect > 0 ? 'Positiva ✅' : 'Negativa ❌' };
}

function calcularFatorLucro() {
  const totalGanho = estado.operacoes.filter(o => o.valor > 0).reduce((s, o) => s + o.valor, 0);
  const totalPerdido = Math.abs(estado.operacoes.filter(o => o.valor < 0).reduce((s, o) => s + o.valor, 0));
  if (totalPerdido === 0) return { fator: 0, info: 'Sem perdas' };
  const fator = totalGanho / totalPerdido;
  return { fator, info: fator > 2 ? 'Excelente' : fator > 1 ? 'Lucrativo' : 'Prejuízo' };
}

function calcularMetaMensal() {
  const hoje = new Date();
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const resultadoMes = resultadoPeriodo(operacoesDoMes(mesAno));
  const meta = estado.metaMensal || 0;
  const percentual = meta > 0 ? Math.min(100, (resultadoMes / meta) * 100) : 0;
  return { meta, resultadoMes, percentual };
}

function calcularStatsConta() {
  const totalOps = estado.operacoes.length;
  const diasAtivos = new Set(estado.operacoes.map(o => o.data)).size;
  const banca = bancaAtual();
  const depositosTotal = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const roi = depositosTotal > 0 ? ((banca - depositosTotal) / depositosTotal) * 100 : 0;
  return { totalOps, diasAtivos, roi, banca };
}

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
      if (lista && lista.style.display === 'block') fecharDropdownAtivo();
      else abrirDropdownAtivo();
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
      if (!nome) { toast('Digite o nome', 'aviso'); return; }
      if (estado.ativos.includes(nome)) { toast('Já existe', 'aviso'); return; }
      estado.ativos.push(nome);
      estado.ativoSelecionado = nome;
      salvar(); renderizarDropdownAtivos(); atualizarTextoAtivo(); fecharDropdownAtivo();
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
  set('stopInfo', `${ms.stopPercentual}% · ${ms.winsHoje > 20 ? '10%' : '5% padrão'}`);

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
  if (bvSub) bvSub.textContent = `Sua banca está em ${formatarMoeda(banca)}.`;

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
  if (toggle) toggle.classList.toggle('ativo', estado.ocultarValores);
}

async function trocarSenha() {
  const novaSenha = prompt('Digite sua NOVA senha (mín. 6 caracteres):');
  if (!novaSenha) return;
  if (novaSenha.length < 6) { toast('Senha muito curta', 'erro'); return; }
  const confirmar = prompt('Confirme a nova senha:');
  if (novaSenha !== confirmar) { toast('Senhas não coincidem', 'erro'); return; }
  try {
    const { auth, updatePassword } = window.__fb;
    await updatePassword(auth.currentUser, novaSenha);
    toast('✅ Senha alterada!', 'sucesso');
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') toast('Faça login novamente', 'aviso', 5000);
    else toast('Erro: ' + e.message, 'erro');
  }
}

async function trocarEmail() {
  const novoEmail = prompt('Digite seu NOVO email:');
  if (!novoEmail) return;
  if (!novoEmail.includes('@')) { toast('Email inválido', 'erro'); return; }
  if (!confirm('⚠️ Vai chegar email de confirmação. Continuar?')) return;
  try {
    const { auth, updateEmail } = window.__fb;
    await updateEmail(auth.currentUser, novoEmail);
    toast('📧 Email alterado! Confirme no novo endereço.', 'sucesso', 6000);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') toast('Faça login novamente', 'aviso', 5000);
    else if (e.code === 'auth/email-already-in-use') toast('Email em uso', 'erro');
    else toast('Erro: ' + e.message, 'erro');
  }
}

async function resetarSenhaEmail() {
  if (!window.__fb || !window.__fb.auth.currentUser) return;
  const email = window.__fb.auth.currentUser.email;
  if (!confirm(`Enviar email para ${email}?`)) return;
  try {
    const { auth, sendPasswordResetEmail } = window.__fb;
    await sendPasswordResetEmail(auth, email);
    toast('📧 Email enviado!', 'sucesso', 5000);
  } catch (e) { toast('Erro: ' + e.message, 'erro'); }
}

async function analisarComIA() {
  if (!window.__fb || !window.__fb.model) { toast('IA não configurada', 'erro', 5000); return; }
  const ops = estado.operacoes;
  if (ops.length === 0) { toast('Registre pelo menos 1 operação', 'aviso'); return; }
  const modal = document.getElementById('modalIA');
  const conteudo = document.getElementById('analiseIAConteudo');
  if (modal) modal.style.display = 'flex';
  if (conteudo) conteudo.innerHTML = '<p style="text-align:center;color:var(--texto-secundario);padding:40px;">🤖 Analisando...</p>';
  const prompt = gerarTextoIA();
  try {
    const { model } = window.__fb;
    const result = await model.generateContent(prompt);
    const texto = result.response.text();
    if (conteudo) conteudo.innerHTML = texto.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '<br>').join('');
  } catch (e) {
    if (conteudo) conteudo.innerHTML = `<p style="color:var(--vermelho);text-align:center;padding:20px;">❌ Erro: ${e.message}</p>`;
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
  const sharpe = calcularSharpe();
  const payoff = calcularPayoff();
  const exp = calcularExpectancia();
  const fator = calcularFatorLucro();
  let texto = 'Sou trader e uso o FerrTrading. Analise:\n\n';
  texto += `Saldo: ${formatarMoeda(banca)}\n`;
  texto += `Total ops: ${total}\n`;
  texto += `Wins: ${wins.length} | Loss: ${losses.length} | Empates: ${empates.length}\n`;
  texto += `Taxa acerto: ${taxa.toFixed(1)}%\n`;
  texto += `Resultado: ${formatarMoeda(resultado)}\n\n`;
  texto += `Sharpe: ${sharpe.sharpe.toFixed(2)}\n`;
  texto += `Payoff: ${payoff.payoff.toFixed(2)}\n`;
  texto += `Expectância: ${formatarMoeda(exp.expect)}\n`;
  texto += `Fator Lucro: ${fator.fator.toFixed(2)}\n\n`;
  texto += 'Me dê insights práticos e sugestões.';
  return texto;
}

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
  if (badge) badge.textContent = `+${operacoesDoMes(mesAno).length} este mês`;
  if (ops.length === 0) {
    container.innerHTML = '<p class="placeholder-texto">Nenhuma operação registrada</p>';
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
      <div class="item-vision-icon ${tipoClass}"><i data-lucide="${icone}"></i></div>
      <div class="item-vision-info">
        <div class="item-vision-titulo">${o.ativo || 'Sem ativo'}</div>
        <div class="item-vision-sub">${o.data.split('-').reverse().join('/')} · ${o.hora || '--:--'}</div>
      </div>
      <div class="item-vision-valor ${tipoClass}">${sinal}${formatarMoeda(o.valor)}</div>
    `;
    container.appendChild(div);
  });
}

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

function renderizarHistorico() {
  const filtroEl = document.getElementById('filtroMes');
  const filtro = filtroEl ? filtroEl.value : '';
  let ops = estado.operacoes.slice().reverse();
  if (filtro) ops = ops.filter(o => o.data.startsWith(filtro));
  const badge = document.getElementById('historicoBadge');
  const mesAno = new Date().toISOString().slice(0, 7);
  if (badge) badge.textContent = `${estado.operacoes.filter(o => o.data.startsWith(mesAno)).length} operações este mês`;
  const corpo = document.getElementById('corpoHistorico');
  if (!corpo) return;
  corpo.innerHTML = '';
  if (ops.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--texto-terciario);padding:40px;">Nenhuma operação</td></tr>';
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
      <td><button class="btn-remover-vision" onclick="removerOperacao('${o.id}')"><i data-lucide="trash-2"></i></button></td>
    `;
    corpo.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

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
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--texto-terciario);padding:40px;">Sem dados</td></tr>';
  }
  Object.keys(meses).sort().reverse().forEach(mes => {
    const m = meses[mes];
    const tr = document.createElement('tr');
    let metaTexto = '-';
    if (mes === mesAtual && estado.metaMensal > 0) metaTexto = `${((m.lucro / estado.metaMensal) * 100).toFixed(0)}%`;
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

function renderizarHorario() {
  const corpo = document.getElementById('corpoHorario');
  if (!corpo) return;
  corpo.innerHTML = '';
  const faixas = [
    { label: '00h - 06h', min: 0, max: 6 }, { label: '06h - 09h', min: 6, max: 9 },
    { label: '09h - 12h', min: 9, max: 12 }, { label: '12h - 15h', min: 12, max: 15 },
    { label: '15h - 18h', min: 15, max: 18 }, { label: '18h - 21h', min: 18, max: 21 },
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
      <td>${f.label}</td><td>${ops.length}</td>
      <td class="win">${wins}</td><td class="loss">${losses}</td>
      <td class="${resultado >= 0 ? 'win' : 'loss'}">${formatarMoeda(resultado)}</td>
      <td>${formatarPercentual(assert)}</td>
    `;
    corpo.appendChild(tr);
  });
}

function renderizarSaques() {
  const container = document.getElementById('listaSaques');
  const saques = estado.saques.slice().reverse();
  const total = estado.saques.reduce((s, x) => s + x.valor, 0);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('saquesTotal', formatarMoeda(total));
  set('saquesQuantidade', estado.saques.length);
  if (saques.length > 0) set('saquesUltimo', saques[0].data.split('-').reverse().join('/') + ' · ' + formatarMoeda(saques[0].valor));
  else set('saquesUltimo', '-');
  if (!container) return;
  container.innerHTML = '';
  if (saques.length === 0) {
    container.innerHTML = '<p class="placeholder-texto">Nenhum saque registrado</p>';
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
  salvar(); renderizar();
  toast('Saque removido', 'info');
};

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
    el.className = 'cal-dia-semana'; el.textContent = d;
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
    el.innerHTML = `<div class="cal-dia-num">${dia}</div><div class="cal-dia-valor">${ops.length > 0 ? formatarMoeda(resultado) : ''}</div>`;
    grid.appendChild(el);
  }
}

let chartLinha = null, chartBarras = null, chartPizzaTipo = null, chartDiaSemana = null;
let chartKelly = null, chartDrawdown = null, chartSharpe = null, chartGanhoPerda = null;
let chartAtivo = null, chartMes = null, chartRosca = null, chartMetaMensal = null;

const COR_AZUL = '#0066FF', COR_AZUL_CLARO = '#1597FF', COR_AZUL_ESCURO = '#0755C9';
const COR_VERDE = '#00C98B', COR_VERMELHO = '#FF3B55', COR_AMARELO = '#FFB547';
const COR_TEXTO = '#8B9BC2', COR_GRID = '#102653', COR_FUNDO = '#061332';
const fmtMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function optsBase() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: COR_TEXTO, font: { size: 11, weight: '600' }, padding: 12, usePointStyle: true } },
      tooltip: { backgroundColor: COR_FUNDO, borderColor: COR_GRID, borderWidth: 1, titleColor: COR_AZUL_CLARO, bodyColor: '#F5F7FF', padding: 12, cornerRadius: 8, displayColors: false }
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
  if (chartMetaMensal) { chartMetaMensal.data.datasets[0].data = dados; chartMetaMensal.update('none'); return; }
  chartMetaMensal = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Concluído', 'Restante'], datasets: [{ data: dados, backgroundColor: [COR_AZUL_CLARO, COR_GRID], borderColor: 'transparent', borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

function renderizarGrafico() {
  const canvas = document.getElementById('graficoBanca');
  if (!canvas || typeof Chart === 'undefined') return;
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial;
  const labels = ['Início'], valores = [saldo];
  ops.forEach(o => {
    saldo += o.valor;
    labels.push(new Date(o.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(saldo);
  });
  if (chartLinha) { chartLinha.data.labels = labels; chartLinha.data.datasets[0].data = valores; chartLinha.update('none'); return; }
  const ctx = canvas.getContext('2d');
  const gradiente = ctx.createLinearGradient(0, 0, 0, 320);
  gradiente.addColorStop(0, 'rgba(0, 102, 255, 0.4)');
  gradiente.addColorStop(1, 'rgba(0, 102, 255, 0)');
  chartLinha = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Saldo', data: valores, borderColor: COR_AZUL_CLARO, backgroundColor: gradiente, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 }] },
    options: { ...optsBase(), interaction: { intersect: false, mode: 'index' }, plugins: { ...optsBase().plugins, legend: { display: false } }, scales: escalas() }
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
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(resultadoPeriodo(operacoesDoDia(dataStr)));
  }
  if (chartBarras) { chartBarras.data.labels = labels; chartBarras.data.datasets[0].data = valores; chartBarras.update('none'); return; }
  chartBarras = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Resultado', data: valores, backgroundColor: '#F5F7FF', borderRadius: 4, borderSkipped: false, barThickness: 8 }] },
    options: { ...optsBase(), plugins: { ...optsBase().plugins, legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: COR_TEXTO, font: { size: 9 }, maxTicksLimit: 15 } }, y: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } } } }
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
  if (chartPizzaTipo) { chartPizzaTipo.data.datasets[0].data = dados; chartPizzaTipo.update('none'); return; }
  chartPizzaTipo = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Wins', 'Loss', 'Empates'], datasets: [{ data: dados, backgroundColor: [COR_VERDE, COR_VERMELHO, COR_AMARELO], borderColor: COR_FUNDO, borderWidth: 3 }] },
    options: { ...optsBase(), cutout: '60%', plugins: { ...optsBase().plugins, legend: { position: 'bottom' } } }
  });
}

function renderizarDiaSemana() {
  const canvas = document.getElementById('graficoDiaSemana');
  if (!canvas) return;
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const valores = [0, 0, 0, 0, 0, 0, 0];
  estado.operacoes.forEach(o => { valores[new Date(o.data + 'T00:00').getDay()] += o.valor; });
  const cores = valores.map(v => v >= 0 ? COR_VERDE : COR_VERMELHO);
  if (chartDiaSemana) { chartDiaSemana.data.datasets[0].data = valores; chartDiaSemana.data.datasets[0].backgroundColor = cores; chartDiaSemana.update('none'); return; }
  chartDiaSemana = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: dias, datasets: [{ data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }] },
    options: { ...optsBase(), plugins: { ...optsBase().plugins, legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: COR_TEXTO } }, y: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } } } }
  });
}

function renderizarKelly() {
  const canvas = document.getElementById('graficoKelly');
  if (!canvas) return;
  const k = calcularKelly();
  const dados = [k.kelly, Math.max(0, 100 - k.kelly)];
  if (chartKelly) { chartKelly.data.datasets[0].data = dados; chartKelly.update('none'); return; }
  chartKelly = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Kelly', 'Restante'], datasets: [{ data: dados, backgroundColor: [COR_AZUL_CLARO, COR_GRID], borderColor: 'transparent', borderWidth: 0 }] },
    options: { ...optsBase(), cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

function renderizarDrawdown() {
  const canvas = document.getElementById('graficoDrawdown');
  if (!canvas) return;
  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial, topo = saldo;
  const labels = ['Início'], valores = [0];
  ops.forEach(o => {
    saldo += o.valor;
    if (saldo > topo) topo = saldo;
    labels.push(new Date(o.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    valores.push(topo > 0 ? -((topo - saldo) / topo) * 100 : 0);
  });
  if (chartDrawdown) { chartDrawdown.data.labels = labels; chartDrawdown.data.datasets[0].data = valores; chartDrawdown.update('none'); return; }
  chartDrawdown = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ data: valores, borderColor: COR_VERMELHO, backgroundColor: 'rgba(255, 59, 85, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }] },
    options: { ...optsBase(), plugins: { ...optsBase().plugins, legend: { display: false } }, scales: { x: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, font: { size: 9 }, maxTicksLimit: 6 } }, y: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, callback: (v) => v.toFixed(0) + '%' } } } }
  });
}

function renderizarSharpe() {
  const canvas = document.getElementById('graficoSharpe');
  if (!canvas) return;
  const s = calcularSharpe();
  const perc = (Math.max(0, Math.min(3, s.sharpe)) / 3) * 100;
  const dados = [perc, 100 - perc];
  if (chartSharpe) { chartSharpe.data.datasets[0].data = dados; chartSharpe.update('none'); return; }
  chartSharpe = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Sharpe', 'Restante'], datasets: [{ data: dados, backgroundColor: [COR_VERDE, COR_GRID], borderColor: 'transparent', borderWidth: 0 }] },
    options: { ...optsBase(), cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
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
  if (chartGanhoPerda) { chartGanhoPerda.data.datasets[0].data = dados; chartGanhoPerda.update('none'); return; }
  chartGanhoPerda = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: ['Ganho', 'Perda'], datasets: [{ data: dados, backgroundColor: [COR_VERDE, COR_VERMELHO], borderRadius: 6, borderSkipped: false }] },
    options: { ...optsBase(), indexAxis: 'y', plugins: { ...optsBase().plugins, legend: { display: false } }, scales: { x: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }, y: { grid: { display: false }, ticks: { color: COR_TEXTO, font: { size: 12 } } } } }
  });
}

function renderizarAtivo() {
  const canvas = document.getElementById('graficoAtivo');
  if (!canvas) return;
  const ativos = {};
  estado.operacoes.forEach(o => {
    const ativo = o.ativo && o.ativo.trim() ? o.ativo.trim() : 'Sem ativo';
    ativos[ativo] = (ativos[ativo] || 0) + o.valor;
  });
  const labels = Object.keys(ativos);
  const valores = labels.map(a => ativos[a]);
  const cores = [COR_AZUL, COR_AZUL_CLARO, COR_AZUL_ESCURO, COR_VERDE, COR_AMARELO, '#7B61FF', '#FF9800', '#4CAF50'];
  const bgCores = labels.map((_, i) => cores[i % cores.length]);
  if (chartAtivo) { chartAtivo.data.labels = labels; chartAtivo.data.datasets[0].data = valores; chartAtivo.data.datasets[0].backgroundColor = bgCores; chartAtivo.update('none'); return; }
  chartAtivo = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: labels.length ? labels : ['Sem dados'], datasets: [{ data: valores.length ? valores : [1], backgroundColor: bgCores, borderColor: COR_FUNDO, borderWidth: 3 }] },
    options: { ...optsBase(), cutout: '60%', plugins: { ...optsBase().plugins, legend: { position: 'bottom' } } }
  });
}

function renderizarMes() {
  const canvas = document.getElementById('graficoMes');
  if (!canvas) return;
  const meses = {};
  estado.operacoes.forEach(o => { meses[o.data.slice(0, 7)] = (meses[o.data.slice(0, 7)] || 0) + o.valor; });
  const chaves = Object.keys(meses).sort().slice(-6);
  const labels = chaves.map(m => m.split('-').reverse().join('/'));
  const valores = chaves.map(m => meses[m]);
  const cores = valores.map(v => v >= 0 ? COR_VERDE : COR_VERMELHO);
  if (chartMes) { chartMes.data.labels = labels; chartMes.data.datasets[0].data = valores; chartMes.data.datasets[0].backgroundColor = cores; chartMes.update('none'); return; }
  chartMes = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderRadius: 6, borderSkipped: false }] },
    options: { ...optsBase(), plugins: { ...optsBase().plugins, legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: COR_TEXTO } }, y: { grid: { color: COR_GRID }, ticks: { color: COR_TEXTO, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } } } }
  });
}

function renderizarTodosGraficos() {
  if (typeof Chart === 'undefined') return;
  renderizarPizzaTipo(); renderizarDiaSemana(); renderizarKelly();
  renderizarDrawdown(); renderizarSharpe(); renderizarGanhoPerda();
  renderizarAtivo(); renderizarMes();
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
  if (chartRosca) { chartRosca.data.datasets[0].data = dados; chartRosca.data.datasets[0].backgroundColor = cores; chartRosca.update('none'); return; }
  chartRosca = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: total === 0 ? ['Sem dados'] : ['Wins', 'Loss'], datasets: [{ data: dados, backgroundColor: cores, borderColor: 'transparent', borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false } } }
  });
}

function registrarOperacao(tipo) {
  const ativo = estado.ativoSelecionado || '';
  const valor = parseFloat(document.getElementById('inputValor').value);
  const data = document.getElementById('inputData').value;
  const hora = document.getElementById('inputHora').value;
  if (!ativo) return toast('Escolha um ativo', 'erro');
  if (!data) return toast('Informe a data', 'erro');
  if (isNaN(valor) || valor <= 0) return toast('Valor inválido', 'erro');
  let valorFinal;
  if (tipo === 'LOSS') valorFinal = -Math.abs(valor);
  else if (tipo === 'EMPATE') valorFinal = 0;
  else valorFinal = Math.abs(valor);
  estado.operacoes.push({ id: Date.now() + Math.random(), tipo, ativo, valor: valorFinal, data, hora });
  salvar();
  estado.ativoSelecionado = null;
  document.getElementById('inputValor').value = '';
  renderizarDropdownAtivos(); atualizarTextoAtivo(); renderizar();
  if (tipo === 'WIN') tocarBeep('win');
  else if (tipo === 'LOSS') tocarBeep('loss');
  else tocarBeep('empate');
  const emoji = tipo === 'WIN' ? '✅' : tipo === 'LOSS' ? '❌' : '➖';
  toast(emoji + ' ' + tipo + ' ' + ativo + ': ' + formatarMoeda(Math.abs(valorFinal)),
    tipo === 'WIN' ? 'sucesso' : tipo === 'LOSS' ? 'erro' : 'info');
}

function removerOperacao(id) {
  if (!confirm('Remover esta operação?')) return;
  estado.operacoes = estado.operacoes.filter(o => String(o.id) !== String(id));
  salvar(); renderizar();
  toast('Operação removida', 'info');
}

function registrarSaque(percentual) {
  if (!percentual) {
    const hoje = new Date();
    percentual = hoje.getDate() <= 15 ? 15 : 30;
  }
  const banca = bancaAtual();
  if (banca <= 0) { toast('Saldo zerado', 'erro'); return; }
  const tipo = percentual === 15 ? 'Quinzenal' : 'Mensal';
  const valor = banca * (percentual / 100);
  if (!confirm('Saque ' + percentual + '% (' + tipo + ')?\n\nSaldo: ' + formatarMoeda(banca) + '\nSaque: ' + formatarMoeda(valor))) return;
  estado.saques.push({ id: Date.now(), valor, data: new Date().toISOString().split('T')[0], tipo });
  salvar(); renderizar();
  toast('💸 Saque ' + tipo + ': ' + formatarMoeda(valor), 'sucesso');
}

function registrarDeposito() {
  const valor = parseFloat(document.getElementById('inputDeposito').value);
  const data = document.getElementById('inputDepositoData').value;
  const tipo = document.getElementById('inputDepositoTipo').value;
  if (isNaN(valor) || valor <= 0) return toast('Valor inválido', 'erro');
  if (!data) return toast('Informe a data', 'erro');
  if (tipo === 'DEPOSITO') estado.depositos.push({ id: Date.now(), valor, data });
  else estado.saques.push({ id: Date.now(), valor, data, tipo: 'Manual' });
  salvar();
  document.getElementById('inputDeposito').value = '';
  renderizar();
  toast((tipo === 'DEPOSITO' ? '💰 Depósito' : '💸 Saque') + ': ' + formatarMoeda(valor), 'sucesso');
}

function tocarBeep(tipo) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (tipo === 'sinal') {
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (tipo === 'win') {
      osc.frequency.value = 1200; osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else if (tipo === 'loss') {
      osc.frequency.value = 300; osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    } else if (tipo === 'empate') {
      osc.frequency.value = 600; osc.type = 'triangle';
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {}
}

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
  }
  const payoff = calcularPayoff(), exp = calcularExpectancia(), fator = calcularFatorLucro();
  set('relatorioPayoff', payoff.payoff.toFixed(2));
  set('relatorioExpect', formatarMoeda(exp.expect));
  set('relatorioFator', fator.fator.toFixed(2));
  const corpo = document.getElementById('relatorioOpsCorpo');
  if (corpo) {
    corpo.innerHTML = '';
    ops.slice().reverse().forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.data.split('-').reverse().join('/')}</td><td>${o.hora || '-'}</td><td>${o.ativo || '-'}</td>
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

window.fecharRelatorioPDF = function() { document.getElementById('relatorioPDF').style.display = 'none'; };

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
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#061332'); grad.addColorStop(1, '#050B27');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#0066FF'; ctx.fillRect(0, 0, 1080, 6);
  ctx.fillStyle = '#1597FF'; ctx.font = 'bold 52px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FerrTrading', 540, 160);
  ctx.fillStyle = '#8B9BC2'; ctx.font = '600 32px Inter, sans-serif';
  const titulos = { dia: 'RESULTADO DE HOJE', semana: 'RESULTADO DA SEMANA', mes: 'RESULTADO DO MÊS' };
  ctx.fillText(titulos[periodo] || 'RESULTADO', 540, 230);
  let ops = [];
  const hoje = new Date();
  if (periodo === 'dia') ops = estado.operacoes.filter(o => o.data === hoje.toISOString().split('T')[0]);
  else if (periodo === 'semana') {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - hoje.getDay());
    inicio.setHours(0, 0, 0, 0);
    ops = estado.operacoes.filter(o => new Date(o.data + 'T00:00') >= inicio);
  } else if (periodo === 'mes') ops = estado.operacoes.filter(o => o.data.startsWith(hoje.toISOString().slice(0, 7)));
  const resultado = ops.reduce((s, o) => s + o.valor, 0);
  const wins = ops.filter(o => o.tipo === 'WIN').length;
  const losses = ops.filter(o => o.tipo === 'LOSS').length;
  ctx.shadowColor = resultado >= 0 ? 'rgba(0, 201, 139, 0.6)' : 'rgba(255, 59, 85, 0.6)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = resultado >= 0 ? '#00C98B' : '#FF3B55';
  ctx.font = 'bold 140px Inter, sans-serif';
  ctx.fillText(resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 540, 500);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0A1738'; ctx.strokeStyle = '#102653'; ctx.lineWidth = 2;
  ctx.beginPath(); roundRect(ctx, 120, 780, 400, 220, 24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00C98B'; ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(wins, 320, 900);
  ctx.fillStyle = '#8B9BC2'; ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('WINS', 320, 960);
  ctx.fillStyle = '#0A1738';
  ctx.beginPath(); roundRect(ctx, 560, 780, 400, 220, 24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FF3B55'; ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(losses, 760, 900);
  ctx.fillStyle = '#8B9BC2'; ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('LOSS', 760, 960);
  ctx.fillStyle = '#8B9BC2'; ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('SALDO ATUAL', 540, 1150);
  ctx.fillStyle = '#F5F7FF'; ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(formatarMoeda(bancaAtual()), 540, 1250);
  const t = wins + losses;
  const taxa = t > 0 ? ((wins / t) * 100).toFixed(0) : 0;
  ctx.fillStyle = '#8B9BC2'; ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('ASSERTIVIDADE', 540, 1400);
  ctx.fillStyle = '#1597FF'; ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(taxa + '%', 540, 1500);
  ctx.fillStyle = '#0066FF'; ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('groupferr.github.io/ferrtrading', 540, 1750);
  ctx.fillStyle = '#5A6B8C'; ctx.font = '500 26px Inter, sans-serif';
  ctx.fillText('Gerencie sua banca com segurança', 540, 1800);
  return canvas;
}

function exportarCSV() {
  if (estado.operacoes.length === 0) return toast('Sem operações para exportar', 'erro');
  let csv = 'Data,Hora,Ativo,Tipo,Valor\n';
  estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data)).forEach(o => {
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

async function resetarDados() {
  estado = {
    bancaInicial: 0, operacoes: [], depositos: [], saques: [],
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
    try { await setDoc(doc(db, 'usuarios', auth.currentUser.uid), estado); } catch (e) {}
  }
  syncAtivo = false;
  document.getElementById('modalResetar').style.display = 'none';
  renderizarDropdownAtivos(); atualizarTextoAtivo();
  toast('🗑️ Dados resetados!', 'sucesso');
  setTimeout(() => { syncAtivo = true; renderizar(); }, 500);
}

function inicializarLogin() {
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
    if (senha !== senha2) { if (erro) erro.textContent = 'Senhas não coincidem'; return; }
    if (!window.__fb) { if (erro) erro.textContent = 'Firebase carregando...'; return; }
    try {
      const { auth, createUserWithEmailAndPassword } = window.__fb;
      await createUserWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'E-mail já cadastrado',
        'auth/weak-password': 'Senha muito fraca (mín. 6)',
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

window.mudarAba = function(tab) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
  if (tab === 'perfil') renderizarPerfil();
};

let binanceSocket = null;
let binanceAtivos = [];
let binancePrices = {};

const ATIVO_PARA_PAR = {
  'BITCOIN': 'BTCUSDT', 'LITECOIN': 'LTCUSDT', 'CARDANO': 'ADAUSDT', 'BNB': 'BNBUSDT',
  'ETHEREUM': 'ETHUSDT', 'SOLANA': 'SOLUSDT', 'AVAX': 'AVAXUSDT', 'DOGE': 'DOGEUSDT',
  'SUI': 'SUIUSDT', 'XPL': 'XPLUSDT', 'STELLAR': 'XLMUSDT', 'XRP': 'XRPUSDT',
  'POLKADOT': 'DOTUSDT', 'CHAINLINK': 'LINKUSDT', 'MATIC': 'MATICUSDT', 'TRON': 'TRXUSDT'
};

function getAtivosMonitorados() {
  if (!estado.ativos || estado.ativos.length === 0) return ['BITCOIN', 'ETHEREUM', 'SOLANA'];
  return estado.ativos.filter(a => ATIVO_PARA_PAR[a]);
}

function conectarBinance() {
  const ativos = getAtivosMonitorados();
  if (ativos.length === 0) return;
  if (binanceSocket) { try { binanceSocket.close(); } catch(e) {} binanceSocket = null; }
  const streams = ativos.map(a => `${ATIVO_PARA_PAR[a].toLowerCase()}@ticker`).join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  console.log('🔌 Binance:', url);
  atualizarStatusAnalista('conectando');
  binanceSocket = new WebSocket(url);
  binanceSocket.onopen = () => {
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
        preco: parseFloat(data.c), variacao: parseFloat(data.P),
        volume: parseFloat(data.q), alta24h: parseFloat(data.h),
        baixa24h: parseFloat(data.l), ultimaAtualizacao: Date.now()
      };
      atualizarLinhaAtivo(data.s);
    } catch(e) {}
  };
  binanceSocket.onerror = () => atualizarStatusAnalista('desconectado');
  binanceSocket.onclose = () => {
    atualizarStatusAnalista('desconectado');
    const tabAtiva = document.getElementById('tab-analista');
    if (tabAtiva && tabAtiva.classList.contains('active')) {
      setTimeout(() => {
        if (document.getElementById('tab-analista')?.classList.contains('active')) conectarBinance();
      }, 5000);
    }
  };
}

function atualizarStatusAnalista(status) {
  const el = document.getElementById('analistaStatus');
  if (!el) return;
  el.classList.remove('conectado', 'desconectado');
  if (status === 'conectado') { el.innerHTML = '<i data-lucide="wifi"></i> Conectado'; el.classList.add('conectado'); }
  else if (status === 'desconectado') { el.innerHTML = '<i data-lucide="wifi-off"></i> Desconectado'; el.classList.add('desconectado'); }
  else { el.innerHTML = '<i data-lucide="loader"></i> Conectando...'; }
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
      <div class="analista-sinal aguardar" id="analista-sinal-${par}">🟡 --</div>
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
  const sinalEl = document.getElementById(`analista-sinal-${par}`);
  if (precoEl) {
    const precoFormatado = data.preco >= 1
      ? data.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : data.preco.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    precoEl.textContent = `$ ${precoFormatado}`;
  }
  if (varEl) {
    const v = data.variacao;
    varEl.className = 'analista-variacao ' + (v > 0 ? 'positiva' : v < 0 ? 'negativa' : 'neutra');
    varEl.textContent = (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  if (volEl) {
    const vol = data.volume;
    volEl.textContent = vol >= 1e9 ? `Vol: $${(vol/1e9).toFixed(2)}B` : vol >= 1e6 ? `Vol: $${(vol/1e6).toFixed(2)}M` : `Vol: $${(vol/1e3).toFixed(2)}K`;
  }
  if (sinalEl) {
    const sinal = calcularSinalRapido(data);
    sinalEl.className = 'analista-sinal ' + sinal.tipo;
    sinalEl.textContent = sinal.label;
  }
  atualizarContadoresAnalista();
  const tsEl = document.getElementById('analistaUltimaAtualizacao');
  if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('pt-BR');
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

function calcularSinalRapido(data) {
  let scoreC = 0, scoreV = 0;
  if (data.variacao <= -5) scoreC += 3;
  else if (data.variacao <= -3) scoreC += 2;
  else if (data.variacao >= 5) scoreV += 3;
  else if (data.variacao >= 3) scoreV += 2;
  const range = data.alta24h - data.baixa24h;
  if (range > 0) {
    const pos = (data.preco - data.baixa24h) / range;
    if (pos < 0.2) scoreC += 2;
    else if (pos > 0.8) scoreV += 2;
  }
  const diff = scoreC - scoreV;
  if (diff >= 3) return { tipo: 'compra', label: '🟢 COMPRA' };
  if (diff <= -3) return { tipo: 'venda', label: '🔴 VENDA' };
  return { tipo: 'aguardar', label: '🟡 AGUARDAR' };
}

async function buscarVelasBinance(par, limite = 150) {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${par}&interval=1m&limit=${limite}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro');
    const dados = await response.json();
    return dados.map(v => ({
      abertura: parseFloat(v[1]), maxima: parseFloat(v[2]),
      minima: parseFloat(v[3]), fechamento: parseFloat(v[4]),
      volume: parseFloat(v[5]), timestamp: v[0]
    }));
  } catch (e) { return null; }
}

function calcularRSI(velas, periodo = 14) {
  if (velas.length < periodo + 1) return 50;
  let ganhos = 0, perdas = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = velas[i].fechamento - velas[i-1].fechamento;
    if (diff > 0) ganhos += diff;
    else perdas += Math.abs(diff);
  }
  const mg = ganhos / periodo, mp = perdas / periodo;
  if (mp === 0) return 100;
  return 100 - (100 / (1 + (mg / mp)));
}

function calcularMediaMovel(velas, periodo) {
  if (velas.length < periodo) return 0;
  return velas.slice(-periodo).reduce((s, v) => s + v.fechamento, 0) / periodo;
}

function detectarPadrao(velas) {
  if (velas.length < 3) return null;
  const u = velas[velas.length - 1], p = velas[velas.length - 2];
  const corpoU = Math.abs(u.fechamento - u.abertura);
  const corpoP = Math.abs(p.fechamento - p.abertura);
  const rangeU = u.maxima - u.minima;
  const sombraSup = u.maxima - Math.max(u.abertura, u.fechamento);
  const sombraInf = Math.min(u.abertura, u.fechamento) - u.minima;
  if (p.fechamento < p.abertura && u.fechamento > u.abertura && u.fechamento > p.abertura && u.abertura < p.fechamento && corpoU > corpoP * 1.2)
    return { tipo: 'engolfo_alta', descricao: 'Engolfo de Alta' };
  if (p.fechamento > p.abertura && u.fechamento < u.abertura && u.fechamento < p.abertura && u.abertura > p.fechamento && corpoU > corpoP * 1.2)
    return { tipo: 'engolfo_baixa', descricao: 'Engolfo de Baixa' };
  if (sombraInf > corpoU * 2 && sombraSup < corpoU * 0.5 && rangeU > 0)
    return { tipo: 'martelo', descricao: 'Martelo' };
  if (sombraSup > corpoU * 2 && sombraInf < corpoU * 0.5 && rangeU > 0)
    return { tipo: 'shooting_star', descricao: 'Shooting Star' };
  if (corpoU < rangeU * 0.1 && rangeU > 0)
    return { tipo: 'doji', descricao: 'Doji' };
  return null;
}

async function analisarAtivoCompleto(par) {
  const velas = await buscarVelasBinance(par, 150);
  if (!velas || velas.length < 30) return null;
  const confirmacoes = [];
  let scoreC = 0, scoreV = 0;
  const rsi = calcularRSI(velas);
  if (rsi < 30) { confirmacoes.push({ ok: true, texto: `RSI ${rsi.toFixed(1)} (sobrevendido)` }); scoreC += 3; }
  else if (rsi > 70) { confirmacoes.push({ ok: true, texto: `RSI ${rsi.toFixed(1)} (sobrecomprado)` }); scoreV += 3; }
  else if (rsi < 40) { confirmacoes.push({ ok: true, texto: `RSI ${rsi.toFixed(1)} (baixo)` }); scoreC += 1; }
  else if (rsi > 60) { confirmacoes.push({ ok: true, texto: `RSI ${rsi.toFixed(1)} (alto)` }); scoreV += 1; }
  else confirmacoes.push({ ok: false, texto: `RSI ${rsi.toFixed(1)} (neutro)` });
  const mm9 = calcularMediaMovel(velas, 9);
  const mm21 = calcularMediaMovel(velas, 21);
  const precoAtual = velas[velas.length - 1].fechamento;
  if (mm9 > mm21 && precoAtual > mm9) { confirmacoes.push({ ok: true, texto: 'Tendência ALTA' }); scoreC += 2; }
  else if (mm9 < mm21 && precoAtual < mm9) { confirmacoes.push({ ok: true, texto: 'Tendência BAIXA' }); scoreV += 2; }
  else confirmacoes.push({ ok: false, texto: 'Médias cruzadas' });
  const padrao = detectarPadrao(velas);
  if (padrao) {
    if (padrao.tipo === 'engolfo_alta' || padrao.tipo === 'martelo') { confirmacoes.push({ ok: true, texto: padrao.descricao + ' (ALTA)' }); scoreC += 3; }
    else if (padrao.tipo === 'engolfo_baixa' || padrao.tipo === 'shooting_star') { confirmacoes.push({ ok: true, texto: padrao.descricao + ' (BAIXA)' }); scoreV += 3; }
    else confirmacoes.push({ ok: false, texto: padrao.descricao });
  } else confirmacoes.push({ ok: false, texto: 'Sem padrão' });
  const volMedio = velas.slice(-50).reduce((s, v) => s + v.volume, 0) / 50;
  const volAtual = velas[velas.length - 1].volume;
  if (volAtual > volMedio * 1.5) {
    confirmacoes.push({ ok: true, texto: 'Volume alto' });
    if (scoreC > scoreV) scoreC += 1; else if (scoreV > scoreC) scoreV += 1;
  } else confirmacoes.push({ ok: false, texto: 'Volume baixo' });
  const diff = scoreC - scoreV;
  const totalConf = confirmacoes.filter(c => c.ok).length;
  let tipo, label, confianca;
  if (diff >= 3) {
    tipo = 'compra'; label = '🟢 COMPRA';
    confianca = totalConf === 1 ? 50 : totalConf === 2 ? 65 : totalConf === 3 ? 80 : 90;
  } else if (diff <= -3) {
    tipo = 'venda'; label = '🔴 VENDA';
    confianca = totalConf === 1 ? 50 : totalConf === 2 ? 65 : totalConf === 3 ? 80 : 90;
  } else {
    tipo = 'aguardar'; label = '🟡 AGUARDAR'; confianca = 40;
  }
  return { par, tipo, label, confianca, confirmacoes, preco: precoAtual };
}

async function atualizarMelhorOportunidade() {
  const container = document.getElementById('cardOportunidadeConteudo');
  const containerConf = document.getElementById('cardConfirmacoes');
  const containerAcoes = document.getElementById('cardAcoes');
  if (!container) return;
  const ativos = getAtivosMonitorados();
  const analises = [];
  for (const ativo of ativos) {
    const par = ATIVO_PARA_PAR[ativo];
    const analise = await analisarAtivoCompleto(par);
    if (analise && analise.tipo !== 'aguardar') {
      analise.ativoNome = ativo;
      analises.push(analise);
    }
  }
  analises.sort((a, b) => b.confianca - a.confianca);
  if (analises.length === 0) {
    container.innerHTML = `<p class="placeholder-texto">Nenhuma oportunidade clara. Aguarde...</p>`;
    if (containerConf) containerConf.style.display = 'none';
    if (containerAcoes) containerAcoes.style.display = 'none';
    return;
  }
  const melhor = analises[0];
  const sinalClass = melhor.tipo === 'compra' ? '' : melhor.tipo;
  const preco = melhor.preco;
  const isCompra = melhor.tipo === 'compra';
  const entrada = preco;
  const stop = isCompra ? preco * 0.98 : preco * 1.02;
  const alvo = isCompra ? preco * 1.04 : preco * 0.96;
  const formatarPreco = (v) => v >= 1
    ? '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  container.innerHTML = `
    <div class="oportunidade-ativo">
      <div class="oportunidade-ativo-icon ${sinalClass}">${melhor.ativoNome.substring(0, 2)}</div>
      <div>
        <div class="oportunidade-ativo-nome">${melhor.ativoNome}</div>
        <div class="oportunidade-ativo-par">${melhor.par}</div>
      </div>
    </div>
    <div class="oportunidade-sinal ${sinalClass}">
      <div class="oportunidade-sinal-label">SINAL</div>
      <div class="oportunidade-sinal-valor">${melhor.label}</div>
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
      <div class="oportunidade-info-label">CONFIANÇA ${melhor.confianca}%</div>
      <div class="oportunidade-confianca-barra">
        <div class="oportunidade-confianca-preenchida" style="width:${melhor.confianca}%"></div>
      </div>
    </div>
  `;
  if (containerConf) {
    const lista = document.getElementById('confirmacoesLista');
    if (lista) {
      lista.innerHTML = melhor.confirmacoes.map(c => `
        <div class="confirmacao-item ${c.ok ? '' : 'falhou'}">
          <span class="confirmacao-item-icon">${c.ok ? '✅' : '❌'}</span>
          <span>${c.texto}</span>
        </div>
      `).join('');
    }
    containerConf.style.display = 'block';
  }
  if (containerAcoes) {
    containerAcoes.style.display = 'flex';
    const btn = document.getElementById('btnCopiarAbrirBinance');
    if (btn) btn.onclick = () => executarOportunidade(melhor);
  }
  if (melhor.confianca >= 80 && window.__ultimoBeep !== melhor.par + melhor.confianca) {
    window.__ultimoBeep = melhor.par + melhor.confianca;
    tocarBeep('sinal');
  }
}

function executarOportunidade(oportunidade) {
  const preco = oportunidade.preco;
  navigator.clipboard.writeText(preco.toString()).then(() => {
    toast(`📋 Preço ${preco} copiado!`, 'sucesso');
  });
  const url = `https://www.binance.com/pt-BR/trade/${oportunidade.par.replace('USDT', '_USDT')}?type=spot`;
  window.open(url, '_blank');
  toast('🚀 Binance aberta!', 'info', 4000);
}

function desconectarBinance() {
  if (binanceSocket) { try { binanceSocket.close(); } catch(e) {} binanceSocket = null; }
}

const SESSOES = {
  asiatica: { nome: 'Sessão Asiática', icon: '🇯🇵', inicio: 21, status: '🟡 Liquidez Média' },
  europeia: { nome: 'Sessão Europeia', icon: '🇪🇺', inicio: 4, status: '🟢 Alta Liquidez — Bom horário' },
  americana: { nome: 'Sessão Americana', icon: '🇺🇸', inicio: 10, status: '🟢🟢 Alta Liquidez — Melhor horário' },
  foraSessao: { nome: 'Fora de Sessão', icon: '🌙', inicio: 17, status: '🔴 Baixa Liquidez — Evite' }
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
  return { icon: SESSOES[proxima].icon, horario: String(SESSOES[proxima].inicio).padStart(2, '0') + ':00' };
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
    const p = getProximaSessao(sessaoAtual);
    proximaEl.textContent = `${p.icon} ${p.horario}`;
  }
}

setInterval(atualizarCardSessao, 30000);

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 FerrTrading iniciando...');
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
    toast('🔄 Reconectando...', 'info', 2000);
  });

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && tab !== 'analista' && typeof desconectarBinance === 'function') desconectarBinance();
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
  if (btnImportarBackup) btnImportarBackup.addEventListener('click', () => document.getElementById('inputImportar').click());
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
    toast(estado.ocultarValores ? '🔒 Ocultos' : '👁️ Visíveis', 'info', 2000);
  });

  const inputImp = document.getElementById('inputImportar');
  if (inputImp) inputImp.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (confirm('Substituir todos os dados?')) {
          estado = { ...estado, ...dados };
          if (!estado.ativos || estado.ativos.length === 0) {
            estado.ativos = ['BITCOIN','LITECOIN','CARDANO','BNB','ETHEREUM','SOLANA','AVAX','DOGE','SUI','XPL','STELLAR'];
          }
          salvar(); renderizarDropdownAtivos(); atualizarTextoAtivo(); renderizar();
          toast('📤 Backup importado!', 'sucesso');
        }
      } catch (err) { toast('Arquivo inválido', 'erro'); }
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
      toast('💾 Baixado!', 'sucesso');
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
    toast(valor > 0 ? '🎯 Meta: ' + formatarMoeda(valor) : 'Meta removida', 'sucesso');
  });

  const modalReset = document.getElementById('modalResetar');
  const btnFecharModalReset = document.getElementById('btnFecharModalReset');
  const btnConfirmarReset = document.getElementById('btnConfirmarReset');
  const btnCancelarReset = document.getElementById('btnCancelarReset');
  if (btnFecharModalReset) btnFecharModalReset.addEventListener('click', () => { if (modalReset) modalReset.style.display = 'none'; });
  if (btnCancelarReset) btnCancelarReset.addEventListener('click', () => { if (modalReset) modalReset.style.display = 'none'; });
  if (btnConfirmarReset) btnConfirmarReset.addEventListener('click', resetarDados);

  const btnFecharModalPrint = document.getElementById('btnFecharModalPrint');
  if (btnFecharModalPrint) btnFecharModalPrint.addEventListener('click', () => document.getElementById('modalPrint').style.display = 'none');

  inicializarLogin();
  renderizar();
  console.log('✅ FerrTrading inicializado');
});

setInterval(() => {
  const tabAnalista = document.getElementById('tab-analista');
  if (tabAnalista && tabAnalista.classList.contains('active')) {
    atualizarMelhorOportunidade();
  }
}, 30000);

console.log('📦 FerrTrading script.js carregado com sucesso');