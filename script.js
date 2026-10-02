// ==================== ESTADO ====================
let estado = {
  bancaInicial: 0,
  operacoes: [],
  depositos: [],
  saques: [],
  percentualEntrada: 1,
  ocultarValores: false,
  temaClaro: false,
  modoCompacto: false,
  metaMensal: 0,
  mesCalendario: new Date().getMonth(),
  anoCalendario: new Date().getFullYear()
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
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
  syncAtivo = true;
  if (estado.temaClaro) document.body.classList.add('light-mode');
  else document.body.classList.remove('light-mode');
  if (estado.modoCompacto) document.body.classList.add('modo-compacto');
  else document.body.classList.remove('modo-compacto');
  const ic = document.getElementById('iconeTema');
  if (ic) ic.textContent = estado.temaClaro ? '☀️' : '🌙';
  const im = document.getElementById('iconeModo');
  if (im) im.textContent = estado.modoCompacto ? '🔍' : '🔎';
  renderizar();
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
  const hoje = new Date();
  const inputData = document.getElementById('inputData');
  const inputHora = document.getElementById('inputHora');
  const inputDepositoData = document.getElementById('inputDepositoData');
  if (inputData) inputData.value = hoje.toISOString().split('T')[0];
  if (inputHora) inputHora.value = hoje.toTimeString().slice(0, 5);
  if (inputDepositoData) inputDepositoData.value = hoje.toISOString().split('T')[0];
  if (estado.temaClaro) document.body.classList.add('light-mode');
  if (estado.modoCompacto) document.body.classList.add('modo-compacto');
  const ic = document.getElementById('iconeTema');
  if (ic) ic.textContent = estado.temaClaro ? '☀️' : '🌙';
  const im = document.getElementById('iconeModo');
  if (im) im.textContent = estado.modoCompacto ? '🔍' : '🔎';
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
  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  }, duracao);
}

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
}// ==================== RENDERIZAÇÃO PRINCIPAL ====================
function renderizar() {
  const banca = bancaAtual();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAno = hoje.slice(0, 7);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  animarNumero('bancaAtual', banca);
  const entrada = banca * (estado.percentualEntrada / 100);
  set('entradaSugerida', formatarMoeda(entrada));
  set('percentualEntrada', estado.percentualEntrada + '% do saldo');

  const opsDia = operacoesDoDia(hoje);
  const opsSemana = operacoesDaSemana();
  const opsMes = operacoesDoMes(mesAno);

  animarNumero('resultadoDia', resultadoPeriodo(opsDia));
  animarNumero('resultadoSemana', resultadoPeriodo(opsSemana));
  animarNumero('resultadoMes', resultadoPeriodo(opsMes));
  animarNumero('lucroTotal', resultadoPeriodo(estado.operacoes));

  const depTotal = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const saqTotal = estado.saques.reduce((s, x) => s + x.valor, 0);
  set('depositosTotais', formatarMoeda(depTotal - saqTotal));

  const mm = calcularMetaMensal();
  set('metaMensalValor', formatarMoeda(mm.meta));
  set('metaMensalPercentual', mm.percentual.toFixed(1) + '%');
  const elProg = document.getElementById('metaMensalProgresso');
  if (elProg) elProg.style.width = Math.min(100, mm.percentual) + '%';
  if (mm.meta > 0) {
    const falta = Math.max(0, mm.meta - mm.resultadoMes);
    set('metaMensalInfo', `Faturamento: ${formatarMoeda(mm.resultadoMes)} · Falta: ${formatarMoeda(falta)}`);
  } else {
    set('metaMensalInfo', 'Defina sua meta do mês');
  }

  const seq = calcularSequencias();
  const seqEl = document.getElementById('seqAtual');
  if (seqEl) {
    if (seq.seqTipo === 'WIN') { seqEl.textContent = `🔥 ${seq.seqAtual} wins`; seqEl.style.color = '#00e676'; }
    else if (seq.seqTipo === 'LOSS') { seqEl.textContent = `💀 ${seq.seqAtual} loss`; seqEl.style.color = '#ff5252'; }
    else { seqEl.textContent = '-'; seqEl.style.color = '#8892a6'; }
  }
  set('seqMaxWins', seq.maxWins);
  set('seqMaxLoss', seq.maxLoss);

  const ms = calcularMetaStop();
  set('metaDia', formatarMoeda(ms.metaValor));
  set('metaInfo', `${ms.metaPercentual}% do saldo · ${ms.winsHoje} wins hoje`);
  set('stopDia', formatarMoeda(ms.stopValor));
  set('stopInfo', `${ms.stopPercentual}% · ${ms.winsHoje > 20 ? '10% (dia excepcional)' : '5% padrão'}`);

  const alerta = document.getElementById('alertaStop');
  if (alerta) alerta.style.display = (ms.resultadoHoje < 0 && Math.abs(ms.resultadoHoje) >= ms.stopValor) ? 'block' : 'none';

  const contDia = contarPorTipo(opsDia);
  set('winsHoje', contDia.wins);
  set('lossHoje', contDia.losses);
  set('empatesHoje', contDia.empates);

  renderizarMetricasPro();
  renderizarMetricasAvancadas();
  renderizarSaque(banca);
  renderizarHistorico();
  renderizarResumoMensal();
  renderizarGrafico();
  renderizarCalendario();
  renderizarGraficoBarras();
  renderizarHorario();
  renderizarSaques();
  renderizarTodosGraficos();
  renderizarAssertividadeRosca();

  const dataEl = document.getElementById('dataAtual');
  if (dataEl) {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', opcoes);
  }
}

function renderizarMetricasPro() {
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const k = calcularKelly();
  set('kellyValor', estado.ocultarValores ? '••%' : k.kelly.toFixed(1) + '%');
  set('kellyInfo', k.info);
  const dd = calcularDrawdown();
  set('drawdownValor', estado.ocultarValores ? '••%' : dd.maxDD.toFixed(1) + '%');
  set('drawdownInfo', dd.info);
  const vv = calcularVoceVoce();
  set('voceVoceSemana', formatarMoeda(vv.diffSemana));
  const elVV = document.getElementById('voceVoceSemana');
  if (elVV) elVV.style.color = vv.diffSemana >= 0 ? '#00e676' : '#ff5252';
  set('voceVoceInfo', `Semana: ${formatarMoeda(vv.semanaAtual)} vs ${formatarMoeda(vv.semanaPassada)} · Mês: ${formatarMoeda(vv.mesAtual)} vs ${formatarMoeda(vv.mesPassado)}`);
}

function renderizarMetricasAvancadas() {
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const sharpe = calcularSharpe();
  set('sharpeValor', estado.ocultarValores ? '••' : sharpe.sharpe.toFixed(2));
  set('sharpeInfo', sharpe.info);
  const payoff = calcularPayoff();
  set('payoffValor', estado.ocultarValores ? '••' : payoff.payoff.toFixed(2));
  set('payoffInfo', payoff.info);
  const exp = calcularExpectancia();
  set('expectanciaValor', formatarMoeda(exp.expect));
  set('expectanciaInfo', exp.info);
  const fator = calcularFatorLucro();
  set('fatorLucroValor', estado.ocultarValores ? '••' : fator.fator.toFixed(2));
  set('fatorLucroInfo', fator.info);
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
  const corpo = document.getElementById('corpoHistorico');
  if (!corpo) return;
  corpo.innerHTML = '';
  ops.forEach((o) => {
    const tr = document.createElement('tr');
    const temPrint = o.print ? `<button class="btn-ver-print" onclick="verPrint('${o.id}')">📸 Ver</button>` : '-';
    tr.innerHTML = `<td>${o.data.split('-').reverse().join('/')}</td>
      <td>${o.hora || '-'}</td>
      <td>${o.ativo || '-'}</td>
      <td class="${o.tipo.toLowerCase()}">${o.tipo}</td>
      <td class="${o.tipo.toLowerCase()}">${formatarMoeda(o.valor)}</td>
      <td>${temPrint}</td>
      <td><button class="btn-remover" onclick="removerOperacao('${o.id}')">Remover</button></td>`;
    corpo.appendChild(tr);
  });
}

window.verPrint = function(id) {
  const op = estado.operacoes.find(o => String(o.id) === String(id));
  if (!op || !op.print) return;
  const modal = document.getElementById('modalPrint');
  const img = document.getElementById('modalPrintImg');
  if (img) img.src = op.print;
  if (modal) modal.style.display = 'flex';
};

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
  Object.keys(meses).sort().reverse().forEach(mes => {
    const m = meses[mes];
    const tr = document.createElement('tr');
    let metaTexto = '-';
    if (mes === mesAtual && estado.metaMensal > 0) {
      const p = ((m.lucro / estado.metaMensal) * 100).toFixed(0);
      metaTexto = `${p}%`;
    }
    tr.innerHTML = `<td>${mes.split('-').reverse().join('/')}</td>
      <td class="win">${m.wins}</td>
      <td class="loss">${m.losses}</td>
      <td class="${m.lucro >= 0 ? 'win' : 'loss'}">${formatarMoeda(m.lucro)}</td>
      <td>${metaTexto}</td>
      <td>${formatarMoeda(banca)}</td>`;
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

let chartLinha = null;
function renderizarGrafico() {
  const canvas = document.getElementById('graficoBanca');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;
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
  const gradiente = ctx.createLinearGradient(0, 0, 0, 400);
  gradiente.addColorStop(0, 'rgba(0, 230, 118, 0.4)');
  gradiente.addColorStop(1, 'rgba(0, 230, 118, 0)');
  chartLinha = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Saldo', data: valores,
        borderColor: '#00e676', backgroundColor: gradiente,
        borderWidth: 2, fill: true, tension: 0.3,
        pointBackgroundColor: '#00e676', pointBorderColor: '#0a1120',
        pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1526', borderColor: '#1a2235', borderWidth: 1,
          titleColor: '#00e676', bodyColor: '#e6e8ef', padding: 12,
          cornerRadius: 8, displayColors: false,
          callbacks: { label: (ctx) => 'Saldo: ' + ctx.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        },
        zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
      },
      scales: {
        x: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

let chartBarras = null;
function renderizarGraficoBarras() {
  const canvas = document.getElementById('graficoBarras');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;
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
    chartBarras.data.datasets[0].backgroundColor = valores.map(v => v > 0 ? '#00e676' : v < 0 ? '#ff5252' : '#2a3650');
    chartBarras.update('none');
    return;
  }
  const ctx = canvas.getContext('2d');
  const cores = valores.map(v => v > 0 ? '#00e676' : v < 0 ? '#ff5252' : '#2a3650');
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: 'Resultado', data: valores, backgroundColor: cores, borderRadius: 4, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1526', borderColor: '#1a2235', borderWidth: 1,
          titleColor: '#00e676', bodyColor: '#e6e8ef', padding: 12,
          cornerRadius: 8, displayColors: false,
          callbacks: { label: (ctx) => 'Resultado: ' + ctx.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        }
      },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8892a6', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
        y: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

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
    el.innerHTML = `<div class="cal-dia-num">${dia}</div><div class="cal-dia-valor">${ops.length > 0 ? formatarMoeda(resultado) : ''}</div>`;
    grid.appendChild(el);
  }
}

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
    tr.innerHTML = `<td>${f.label}</td><td>${ops.length}</td>
      <td class="win">${wins}</td><td class="loss">${losses}</td>
      <td class="${resultado >= 0 ? 'win' : 'loss'}">${formatarMoeda(resultado)}</td>
      <td>${formatarPercentual(assert)}</td>`;
    corpo.appendChild(tr);
  });
}

function renderizarSaques() {
  const corpo = document.getElementById('corpoSaques');
  if (!corpo) return;
  corpo.innerHTML = '';
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
  if (saques.length === 0) {
    corpo.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8892a6;padding:30px;">Nenhum saque registrado ainda</td></tr>';
    return;
  }
  saques.forEach(s => {
    const bancaAntes = bancaAtual();
    const percentual = bancaAntes > 0 ? ((s.valor / bancaAntes) * 100).toFixed(1) : '0';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.data.split('-').reverse().join('/')}</td>
      <td>${s.tipo || 'Manual'}</td>
      <td class="loss">-${formatarMoeda(s.valor)}</td>
      <td>${percentual}%</td>
      <td><button class="btn-remover" onclick="removerSaque('${s.id}')">Remover</button></td>`;
    corpo.appendChild(tr);
  });
}

window.removerSaque = function(id) {
  if (!confirm('Remover este saque?')) return;
  estado.saques = estado.saques.filter(s => String(s.id) !== String(id));
  salvar();
  renderizar();
  toast('Saque removido', 'info');
};

// ==================== GRÁFICOS ====================
let chartPizzaTipo = null;
let chartDiaSemana = null;
let chartKelly = null;
let chartDrawdown = null;
let chartAssertividade = null;
let chartGanhoPerda = null;
let chartAtivo = null;
let chartMes = null;
let chartRosca = null;

function renderizarTodosGraficos() {
  if (typeof Chart === 'undefined') return;
  renderizarPizzaTipo();
  renderizarDiaSemana();
  renderizarKelly();
  renderizarDrawdown();
  renderizarAssertividade();
  renderizarGanhoPerda();
  renderizarAtivo();
  renderizarMes();
}

const chartOptsBase = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#e6e8ef', font: { size: 11, weight: '600' }, padding: 12, usePointStyle: true } },
    tooltip: { backgroundColor: '#0d1526', borderColor: '#1a2235', borderWidth: 1, titleColor: '#00e676', bodyColor: '#e6e8ef', padding: 12, cornerRadius: 8, displayColors: false }
  }
};

const fmtMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Rosca de Assertividade (aba Performance)
function renderizarAssertividadeRosca() {
  const canvas = document.getElementById('graficoAssertividadeRosca');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;
  const wins = estado.operacoes.filter(o => o.tipo === 'WIN').length;
  const losses = estado.operacoes.filter(o => o.tipo === 'LOSS').length;
  const total = wins + losses;
  const percentual = total > 0 ? (wins / total) * 100 : 0;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('assertividadePercentualCentro', percentual.toFixed(1) + '%');
  set('assertividadeContadorCentro', `${wins}W · ${losses}L`);

  const dados = total === 0 ? [1, 0] : [wins, losses];
  const cores = total === 0 ? ['#1a2235', '#1a2235'] : ['#00e676', '#ff5252'];

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
      datasets: [{
        data: dados,
        backgroundColor: cores,
        borderColor: '#0a1120',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1526', borderColor: '#1a2235', borderWidth: 1,
          titleColor: '#00e676', bodyColor: '#e6e8ef', padding: 12,
          cornerRadius: 8, displayColors: false,
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
      datasets: [{ data: dados, backgroundColor: ['#00e676', '#ff5252', '#ffc107'], borderColor: '#0a1120', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      ...chartOptsBase,
      cutout: '55%',
      plugins: {
        ...chartOptsBase.plugins,
        legend: { position: 'bottom', labels: { color: '#e6e8ef', font: { size: 11, weight: '600' }, padding: 12, usePointStyle: true } },
        tooltip: {
          ...chartOptsBase.plugins.tooltip,
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
  const cores = valores.map(v => v >= 0 ? '#00e676' : '#ff5252');
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
      ...chartOptsBase,
      plugins: { ...chartOptsBase.plugins, legend: { display: false }, tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8892a6', font: { size: 11 } } },
        y: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
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
      labels: [`Risco ideal (${k.kelly.toFixed(1)}%)`, 'Restante'],
      datasets: [{ data: dados, backgroundColor: ['#40c4ff', '#1a2235'], borderColor: '#0a1120', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      ...chartOptsBase,
      cutout: '65%',
      plugins: {
        ...chartOptsBase.plugins,
        legend: { position: 'bottom', labels: { color: '#e6e8ef', font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } }
      }
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
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, 'rgba(255, 82, 82, 0)');
  grad.addColorStop(1, 'rgba(255, 82, 82, 0.5)');
  chartDrawdown = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Drawdown %', data: valores,
        borderColor: '#ff5252', backgroundColor: grad,
        borderWidth: 2, fill: true, tension: 0.3,
        pointBackgroundColor: '#ff5252', pointRadius: 3, pointHoverRadius: 6
      }]
    },
    options: {
      ...chartOptsBase,
      plugins: { ...chartOptsBase.plugins, legend: { display: false }, tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)}%` } } },
      scales: {
        x: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => v.toFixed(0) + '%' } }
      }
    }
  });
}

function renderizarAssertividade() {
  const canvas = document.getElementById('graficoAssertividade');
  if (!canvas) return;
  const meses = {};
  estado.operacoes.forEach(o => {
    const mes = o.data.slice(0, 7);
    if (!meses[mes]) meses[mes] = { wins: 0, losses: 0 };
    if (o.tipo === 'WIN') meses[mes].wins++;
    if (o.tipo === 'LOSS') meses[mes].losses++;
  });
  const chaves = Object.keys(meses).sort();
  const labels = chaves.map(m => m.split('-').reverse().join('/'));
  const valores = chaves.map(m => {
    const d = meses[m];
    const t = d.wins + d.losses;
    return t > 0 ? (d.wins / t) * 100 : 0;
  });
  if (chartAssertividade) {
    chartAssertividade.data.labels = labels;
    chartAssertividade.data.datasets[0].data = valores;
    chartAssertividade.update('none');
    return;
  }
  chartAssertividade = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Assertividade %', data: valores,
        borderColor: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.15)',
        borderWidth: 2, fill: true, tension: 0.3,
        pointBackgroundColor: '#00e676', pointBorderColor: '#0a1120',
        pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8
      }]
    },
    options: {
      ...chartOptsBase,
      plugins: { ...chartOptsBase.plugins, legend: { display: false }, tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)}%` } } },
      scales: {
        x: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 } } },
        y: { grid: { color: '#1a2235', drawBorder: false }, min: 0, max: 100, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => v + '%' } }
      }
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
      labels: ['Ganho médio', 'Perda média'],
      datasets: [{ data: dados, backgroundColor: ['#00e676', '#ff5252'], borderRadius: 6, borderSkipped: false }]
    },
    options: {
      ...chartOptsBase,
      indexAxis: 'y',
      plugins: { ...chartOptsBase.plugins, legend: { display: false }, tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.x) } } },
      scales: {
        x: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } },
        y: { grid: { display: false, drawBorder: false }, ticks: { color: '#8892a6', font: { size: 12, weight: '600' } } }
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
  const cores = ['#00e676', '#40c4ff', '#a855f7', '#ffc107', '#ff5252', '#00b0ff', '#ff9800', '#4caf50'];
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
      datasets: [{ data: valores.length ? valores : [1], backgroundColor: bgCores, borderColor: '#0a1120', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      ...chartOptsBase,
      cutout: '55%',
      plugins: {
        ...chartOptsBase.plugins,
        legend: { position: 'bottom', labels: { color: '#e6e8ef', font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: {
          ...chartOptsBase.plugins.tooltip,
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
  const cores = valores.map(v => v >= 0 ? '#00e676' : '#ff5252');
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
      ...chartOptsBase,
      plugins: { ...chartOptsBase.plugins, legend: { display: false }, tooltip: { ...chartOptsBase.plugins.tooltip, callbacks: { label: (ctx) => fmtMoeda(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8892a6', font: { size: 11 } } },
        y: { grid: { color: '#1a2235', drawBorder: false }, ticks: { color: '#8892a6', font: { size: 10 }, callback: (v) => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}// ==================== AÇÕES ====================
function registrarOperacao(tipo) {
  const ativo = document.getElementById('inputAtivo').value.trim();
  const valor = parseFloat(document.getElementById('inputValor').value);
  const data = document.getElementById('inputData').value;
  const hora = document.getElementById('inputHora').value;
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
  document.getElementById('inputAtivo').value = '';
  document.getElementById('inputValor').value = '';
  renderizar();

  const emoji = tipo === 'WIN' ? '✅' : tipo === 'LOSS' ? '❌' : '➖';
  toast(emoji + ' ' + tipo + ' registrado: ' + formatarMoeda(Math.abs(valorFinal)),
    tipo === 'WIN' ? 'sucesso' : tipo === 'LOSS' ? 'erro' : 'info');
}

function removerOperacao(id) {
  if (!confirm('Remover esta operação?')) return;
  estado.operacoes = estado.operacoes.filter(o => String(o.id) !== String(id));
  salvar();
  renderizar();
  toast('Operação removida', 'info');
}

function registrarSaque() {
  const banca = bancaAtual();
  const hoje = new Date();
  const dia = hoje.getDate();
  const percentual = dia <= 15 ? 15 : 30;
  const valor = banca * (percentual / 100);
  if (!confirm('Registrar saque ' + percentual + '%?\n\nSaldo: ' + formatarMoeda(banca) + '\nSaque: ' + formatarMoeda(valor))) return;
  estado.saques.push({
    id: Date.now(),
    valor,
    data: hoje.toISOString().split('T')[0],
    tipo: percentual === 15 ? 'Quinzenal' : 'Mensal'
  });
  salvar();
  renderizar();
  toast('💸 Saque registrado: ' + formatarMoeda(valor), 'sucesso');
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
      tr.innerHTML = `<td>${o.data.split('-').reverse().join('/')}</td>
        <td>${o.hora || '-'}</td><td>${o.ativo || '-'}</td>
        <td style="color: ${o.tipo === 'WIN' ? '#00a854' : o.tipo === 'LOSS' ? '#e53e3e' : '#b7791f'}; font-weight: 700;">${o.tipo}</td>
        <td style="text-align: right; font-weight: 700;">${formatarMoeda(o.valor)}</td>`;
      corpo.appendChild(tr);
    });
  }
  const dataEl = document.getElementById('relatorioData');
  if (dataEl) dataEl.textContent = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('relatorioPDF').style.display = 'block';
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
  grad.addColorStop(0, '#0a1120');
  grad.addColorStop(1, '#060911');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#00e676';
  ctx.fillRect(0, 0, 1080, 8);

  ctx.fillStyle = '#00e676';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ FerrTrading', 540, 150);

  ctx.fillStyle = '#8892a6';
  ctx.font = '600 32px Inter, sans-serif';
  const titulos = { dia: 'RESULTADO DE HOJE', semana: 'RESULTADO DA SEMANA', mes: 'RESULTADO DO MÊS' };
  ctx.fillText(titulos[periodo] || 'RESULTADO', 540, 220);

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

  ctx.fillStyle = resultado >= 0 ? '#00e676' : '#ff5252';
  ctx.font = 'bold 140px Inter, sans-serif';
  ctx.fillText(resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 540, 500);
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(resultado >= 0 ? '📈' : '📉', 540, 640);

  ctx.fillStyle = '#0d1526';
  ctx.strokeStyle = '#1a2235';
  ctx.lineWidth = 2;

  ctx.beginPath();
  roundRect(ctx, 120, 780, 400, 220, 24);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00e676';
  ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(wins, 320, 900);
  ctx.fillStyle = '#8892a6';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('WINS', 320, 960);

  ctx.fillStyle = '#0d1526';
  ctx.beginPath();
  roundRect(ctx, 560, 780, 400, 220, 24);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5252';
  ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(losses, 760, 900);
  ctx.fillStyle = '#8892a6';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('LOSS', 760, 960);

  ctx.fillStyle = '#8892a6';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('SALDO ATUAL', 540, 1150);
  ctx.fillStyle = '#e6e8ef';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(formatarMoeda(bancaAtual()), 540, 1250);

  const t = wins + losses;
  const taxa = t > 0 ? ((wins / t) * 100).toFixed(0) : 0;
  ctx.fillStyle = '#8892a6';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('ASSERTIVIDADE', 540, 1400);
  ctx.fillStyle = '#40c4ff';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(taxa + '%', 540, 1500);

  ctx.fillStyle = '#00e676';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('ferrtrading.com', 540, 1750);
  ctx.fillStyle = '#4a5568';
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
    percentualEntrada: 1, ocultarValores: false,
    temaClaro: false, modoCompacto: false, metaMensal: 0,
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
  document.body.classList.remove('light-mode', 'modo-compacto');
  document.getElementById('modalResetar').style.display = 'none';
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
});// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded — iniciando app');
  carregar();

  // NAVEGAÇÃO SIDEBAR
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const el = document.getElementById('tab-' + tab);
      if (el) el.classList.add('active');
      setTimeout(() => {
        if (chartLinha) chartLinha.resize();
        if (chartBarras) chartBarras.resize();
        if (chartRosca) chartRosca.resize();
        if (chartPizzaTipo) chartPizzaTipo.resize();
        if (chartDiaSemana) chartDiaSemana.resize();
        if (chartKelly) chartKelly.resize();
        if (chartDrawdown) chartDrawdown.resize();
        if (chartAssertividade) chartAssertividade.resize();
        if (chartGanhoPerda) chartGanhoPerda.resize();
        if (chartAtivo) chartAtivo.resize();
        if (chartMes) chartMes.resize();
      }, 100);
    });
  });

  // NAVEGAÇÃO MOBILE
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
        if (chartLinha) chartLinha.resize();
        if (chartBarras) chartBarras.resize();
        if (chartRosca) chartRosca.resize();
        if (chartPizzaTipo) chartPizzaTipo.resize();
        if (chartDiaSemana) chartDiaSemana.resize();
        if (chartKelly) chartKelly.resize();
        if (chartDrawdown) chartDrawdown.resize();
        if (chartAssertividade) chartAssertividade.resize();
        if (chartGanhoPerda) chartGanhoPerda.resize();
        if (chartAtivo) chartAtivo.resize();
        if (chartMes) chartMes.resize();
      }, 100);
    });
  });

  // MENU MAIS
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
        if (chartLinha) chartLinha.resize();
        if (chartBarras) chartBarras.resize();
        if (chartRosca) chartRosca.resize();
        if (chartPizzaTipo) chartPizzaTipo.resize();
        if (chartDiaSemana) chartDiaSemana.resize();
        if (chartKelly) chartKelly.resize();
        if (chartDrawdown) chartDrawdown.resize();
        if (chartAssertividade) chartAssertividade.resize();
        if (chartGanhoPerda) chartGanhoPerda.resize();
        if (chartAtivo) chartAtivo.resize();
        if (chartMes) chartMes.resize();
      }, 100);
    });
  });

  const overlay = document.querySelector('.mm-overlay');
  if (overlay) overlay.addEventListener('click', () => {
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  // ALTERNAR ENTRADA
  const btnEnt = document.getElementById('btnAlternarEntrada');
  if (btnEnt) btnEnt.addEventListener('click', () => {
    estado.percentualEntrada = estado.percentualEntrada === 1 ? 10 : 1;
    salvar(); renderizar();
    toast('Entrada alterada para ' + estado.percentualEntrada + '%', 'info', 2000);
  });

  // OCULTAR
  const btnOc = document.getElementById('btnOcultar');
  if (btnOc) btnOc.addEventListener('click', () => {
    estado.ocultarValores = !estado.ocultarValores;
    salvar(); renderizar();
    toast(estado.ocultarValores ? '🔒 Valores ocultos' : '👁️ Visíveis', 'info', 2000);
  });

  // TEMA
  const btnTema = document.getElementById('btnTema');
  if (btnTema) btnTema.addEventListener('click', () => {
    estado.temaClaro = !estado.temaClaro;
    document.body.classList.toggle('light-mode', estado.temaClaro);
    const ic = document.getElementById('iconeTema');
    if (ic) ic.textContent = estado.temaClaro ? '☀️' : '🌙';
    salvar();
    toast(estado.temaClaro ? '☀️ Modo claro' : '🌙 Modo escuro', 'info', 2000);
  });

  // MODO COMPACTO
  const btnModo = document.getElementById('btnModoCompacto');
  if (btnModo) btnModo.addEventListener('click', () => {
    estado.modoCompacto = !estado.modoCompacto;
    document.body.classList.toggle('modo-compacto', estado.modoCompacto);
    const im = document.getElementById('iconeModo');
    if (im) im.textContent = estado.modoCompacto ? '🔍' : '🔎';
    salvar();
    toast(estado.modoCompacto ? '🔍 Modo compacto' : '🔎 Modo normal', 'info', 2000);
  });

  // EXPORTAR
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

  // IMPORTAR
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
          salvar();
          document.body.classList.toggle('light-mode', estado.temaClaro);
          document.body.classList.toggle('modo-compacto', estado.modoCompacto);
          renderizar();
          toast('📤 Backup importado!', 'sucesso');
        }
      } catch (err) { toast('Arquivo inválido.', 'erro'); }
    };
    reader.readAsText(file);
  });

  // REGISTRAR SAQUE
  const btnSaq = document.getElementById('btnRegistrarSaque');
  if (btnSaq) btnSaq.addEventListener('click', registrarSaque);

  // FILTRO
  const filtro = document.getElementById('filtroMes');
  if (filtro) filtro.addEventListener('change', renderizarHistorico);

  const btnLimpar = document.getElementById('btnLimparFiltro');
  if (btnLimpar) btnLimpar.addEventListener('click', () => {
    document.getElementById('filtroMes').value = '';
    renderizarHistorico();
  });

  // CSV
  const btnCSV = document.getElementById('btnExportarCSV');
  if (btnCSV) btnCSV.addEventListener('click', exportarCSV);
  const btnCSVHist = document.getElementById('btnExportarCSVHistorico');
  if (btnCSVHist) btnCSVHist.addEventListener('click', exportarCSV);
  const mmCSV = document.getElementById('mmExportarCSV');
  if (mmCSV) mmCSV.addEventListener('click', () => {
    exportarCSV();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  // CALENDÁRIO NAV
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

  // MENU MAIS — especiais
  const mmTema = document.getElementById('mmTema');
  if (mmTema) mmTema.addEventListener('click', () => {
    estado.temaClaro = !estado.temaClaro;
    document.body.classList.toggle('light-mode', estado.temaClaro);
    const ic = document.getElementById('iconeTema');
    if (ic) ic.textContent = estado.temaClaro ? '☀️' : '🌙';
    salvar();
    toast(estado.temaClaro ? '☀️ Modo claro' : '🌙 Modo escuro', 'info', 2000);
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  const mmModo = document.getElementById('mmModoCompacto');
  if (mmModo) mmModo.addEventListener('click', () => {
    estado.modoCompacto = !estado.modoCompacto;
    document.body.classList.toggle('modo-compacto', estado.modoCompacto);
    const im = document.getElementById('iconeModo');
    if (im) im.textContent = estado.modoCompacto ? '🔍' : '🔎';
    salvar();
    toast(estado.modoCompacto ? '🔍 Modo compacto' : '🔎 Modo normal', 'info', 2000);
    document.getElementById('mobileMenuMais').classList.remove('aberto');
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

  // PWA
  const btnPWA = document.getElementById('btnInstalarPWA');
  if (btnPWA) btnPWA.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') toast('🎉 App instalado!', 'sucesso');
    deferredPrompt = null;
    btnPWA.style.display = 'none';
  });

  // PRINT
  const btnPrintCam = document.getElementById('btnPrintCamera');
  const btnPrintGal = document.getElementById('btnPrintGaleria');
  const inputPrintCam = document.getElementById('inputPrintCamera');
  const inputPrintGal = document.getElementById('inputPrintGaleria');
  if (btnPrintCam) btnPrintCam.addEventListener('click', () => inputPrintCam && inputPrintCam.click());
  if (btnPrintGal) btnPrintGal.addEventListener('click', () => inputPrintGal && inputPrintGal.click());
  if (inputPrintCam) inputPrintCam.addEventListener('change', () => processarPrint(inputPrintCam));
  if (inputPrintGal) inputPrintGal.addEventListener('change', () => processarPrint(inputPrintGal));

  const btnRemPrint = document.getElementById('btnRemoverPrint');
  if (btnRemPrint) btnRemPrint.addEventListener('click', () => {
    window.printAtual = null;
    document.getElementById('printPreview').style.display = 'none';
    document.getElementById('printPreviewImg').src = '';
    if (inputPrintCam) inputPrintCam.value = '';
    if (inputPrintGal) inputPrintGal.value = '';
  });

  const modalPrint = document.getElementById('modalPrint');
  const btnFecharModalPrint = document.getElementById('btnFecharModalPrint');
  if (btnFecharModalPrint) btnFecharModalPrint.addEventListener('click', () => {
    if (modalPrint) modalPrint.style.display = 'none';
  });
  if (modalPrint) modalPrint.addEventListener('click', (e) => {
    if (e.target === modalPrint) modalPrint.style.display = 'none';
  });

  // PIN
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

  // IA
  function abrirAnaliseIA() {
    const modal = document.getElementById('modalIA');
    const texto = document.getElementById('textoIA');
    if (texto) texto.value = gerarTextoIA();
    if (modal) modal.style.display = 'flex';
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

  // PDF
  const btnPDF = document.getElementById('btnRelatorioPDF');
  if (btnPDF) btnPDF.addEventListener('click', gerarRelatorioPDF);
  const mmPDF = document.getElementById('mmRelatorioPDF');
  if (mmPDF) mmPDF.addEventListener('click', () => {
    gerarRelatorioPDF();
    document.getElementById('mobileMenuMais').classList.remove('aberto');
  });

  // COMPARTILHAR
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
  if (btnBaixarCard) btnBaixarCard.addEventListener('click', () => {
    const canvas = document.querySelector('#cardPreview canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'ferrtrading-' + new Date().toISOString().split('T')[0] + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('💾 Imagem baixada!', 'sucesso');
  });

  const btnFecharComp = document.getElementById('btnFecharCompartilhar');
  if (btnFecharComp) btnFecharComp.addEventListener('click', () => {
    if (modalComp) modalComp.style.display = 'none';
  });
  const btnFecharModalComp = document.getElementById('btnFecharModalCompartilhar');
  if (btnFecharModalComp) btnFecharModalComp.addEventListener('click', () => {
    if (modalComp) modalComp.style.display = 'none';
  });

  // META MENSAL
  const btnEditarMeta = document.getElementById('btnEditarMetaMensal');
  const modalMeta = document.getElementById('modalMetaMensal');
  const btnFecharModalMeta = document.getElementById('btnFecharModalMeta');
  const btnSalvarMeta = document.getElementById('btnSalvarMetaMensal');
  const inputMeta = document.getElementById('inputMetaMensal');
  if (btnEditarMeta) btnEditarMeta.addEventListener('click', () => {
    if (inputMeta) inputMeta.value = estado.metaMensal || '';
    if (modalMeta) modalMeta.style.display = 'flex';
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

  // RESET
  const btnReset = document.getElementById('btnResetar');
  const mmReset = document.getElementById('mmResetar');
  const modalReset = document.getElementById('modalResetar');
  const btnFecharModalReset = document.getElementById('btnFecharModalReset');
  const btnConfirmarReset = document.getElementById('btnConfirmarReset');
  const btnCancelarReset = document.getElementById('btnCancelarReset');
  function abrirReset() { if (modalReset) modalReset.style.display = 'flex'; }
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
  console.log('✅ App inicializado');
});

// ==================== FIM ====================
console.log('📦 FerrTrading script.js carregado com sucesso');