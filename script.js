// ==================== ESTADO ====================
let estado = {
  bancaInicial: 1000,
  operacoes: [],
  depositos: [],
  saques: [],
  percentualEntrada: 1,
  ocultarValores: false,
  temaClaro: false,
  mesCalendario: new Date().getMonth(),
  anoCalendario: new Date().getFullYear()
};

// ==================== PERSISTÊNCIA ====================
function salvar() {
  localStorage.setItem('ferrTrading', JSON.stringify(estado));
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
  const ic = document.getElementById('iconeTema');
  if (ic) ic.textContent = estado.temaClaro ? '☀️' : '🌙';
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
  el.innerHTML = `
    <span class="toast-icon">${icons[tipo] || 'ℹ️'}</span>
    <span class="toast-msg">${mensagem}</span>
  `;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  }, duracao);
}

// ==================== ANIMAÇÃO DE NÚMEROS ====================
function animarNumero(id, valorFinal) {
  const el = document.getElementById(id);
  if (!el) return;

  if (estado.ocultarValores) {
    el.textContent = formatarMoeda(valorFinal);
    return;
  }

  const textoAtual = el.textContent.replace(/[^\d,-]/g, '').replace(',', '.');
  const valorAtual = parseFloat(textoAtual) || 0;

  if (Math.abs(valorAtual - valorFinal) < 0.01) {
    el.textContent = formatarMoeda(valorFinal);
    return;
  }

  el.classList.add('numero-animando');
  setTimeout(() => el.classList.remove('numero-animando'), 400);

  const duracao = 500;
  const passos = 20;
  const incremento = (valorFinal - valorAtual) / passos;
  let atual = valorAtual;
  let passo = 0;

  const timer = setInterval(() => {
    passo++;
    atual += incremento;
    if (passo >= passos) {
      atual = valorFinal;
      clearInterval(timer);
    }
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

function operacoesDoDia(data) {
  return estado.operacoes.filter(o => o.data === data);
}

function operacoesDaSemana() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay());
  inicio.setHours(0, 0, 0, 0);
  return estado.operacoes.filter(o => new Date(o.data + 'T00:00') >= inicio);
}

function operacoesDoMes(mesAno) {
  return estado.operacoes.filter(o => o.data.startsWith(mesAno));
}

function resultadoPeriodo(ops) {
  return ops.reduce((s, o) => s + o.valor, 0);
}

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

// ==================== SEQUÊNCIAS ====================
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

// ==================== META E STOP ====================
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

// ==================== RENDERIZAÇÃO PRINCIPAL ====================
function renderizar() {
  const banca = bancaAtual();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAno = hoje.slice(0, 7);

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  // Card principal com animação
  animarNumero('bancaAtual', banca);

  const entrada = banca * (estado.percentualEntrada / 100);
  set('entradaSugerida', formatarMoeda(entrada));
  set('percentualEntrada', estado.percentualEntrada + '% do saldo');

  const opsDia = operacoesDoDia(hoje);
  const opsSemana = operacoesDaSemana();
  const opsMes = operacoesDoMes(mesAno);

  // Mini-cards com animação
  animarNumero('resultadoDia', resultadoPeriodo(opsDia));
  animarNumero('resultadoSemana', resultadoPeriodo(opsSemana));
  animarNumero('resultadoMes', resultadoPeriodo(opsMes));
  animarNumero('lucroTotal', resultadoPeriodo(estado.operacoes));

  set('assertividade', formatarPercentual(calcularAssertividade(opsMes)));
  const contMes = contarPorTipo(opsMes);
  set('contadorWL', `✅ ${contMes.wins} · ❌ ${contMes.losses}`);

  const depTotal = estado.depositos.reduce((s, d) => s + d.valor, 0);
  const saqTotal = estado.saques.reduce((s, x) => s + x.valor, 0);
  set('depositosTotais', formatarMoeda(depTotal - saqTotal));

  // Sequências
  const seq = calcularSequencias();
  const seqEl = document.getElementById('seqAtual');
  if (seqEl) {
    if (seq.seqTipo === 'WIN') { seqEl.textContent = `🔥 ${seq.seqAtual} wins`; seqEl.style.color = '#00e676'; }
    else if (seq.seqTipo === 'LOSS') { seqEl.textContent = `💀 ${seq.seqAtual} loss`; seqEl.style.color = '#ff5252'; }
    else { seqEl.textContent = '-'; seqEl.style.color = '#8892a6'; }
  }
  set('seqMaxWins', seq.maxWins);
  set('seqMaxLoss', seq.maxLoss);

  // Meta e Stop
  const ms = calcularMetaStop();
  set('metaDia', formatarMoeda(ms.metaValor));
  set('metaInfo', `${ms.metaPercentual}% do saldo · ${ms.winsHoje} wins hoje`);
  set('stopDia', formatarMoeda(ms.stopValor));
  set('stopInfo', `${ms.stopPercentual}% · ${ms.winsHoje > 20 ? '10% (dia excepcional)' : '5% padrão'}`);

  const alerta = document.getElementById('alertaStop');
  if (alerta) {
    alerta.style.display = (ms.resultadoHoje < 0 && Math.abs(ms.resultadoHoje) >= ms.stopValor) ? 'block' : 'none';
  }

  const contDia = contarPorTipo(opsDia);
  set('winsHoje', contDia.wins);
  set('lossHoje', contDia.losses);
  set('empatesHoje', contDia.empates);

  renderizarSaque(banca);
  renderizarHistorico();
  renderizarResumoMensal();
  renderizarGrafico();
  renderizarCalendario();
  renderizarGraficoBarras();
  renderizarHorario();

  const dataEl = document.getElementById('dataAtual');
  if (dataEl) {
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', opcoes);
  }
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
    tr.innerHTML = `
      <td>${o.data.split('-').reverse().join('/')}</td>
      <td>${o.hora || '-'}</td>
      <td>${o.ativo || '-'}</td>
      <td class="${o.tipo.toLowerCase()}">${o.tipo}</td>
      <td class="${o.tipo.toLowerCase()}">${formatarMoeda(o.valor)}</td>
      <td><button class="btn-remover" onclick="removerOperacao(${o.id})">Remover</button></td>
    `;
    corpo.appendChild(tr);
  });
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

  Object.keys(meses).sort().reverse().forEach(mes => {
    const m = meses[mes];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${mes.split('-').reverse().join('/')}</td>
      <td class="win">${m.wins}</td>
      <td class="loss">${m.losses}</td>
      <td class="${m.lucro >= 0 ? 'win' : 'loss'}">${formatarMoeda(m.lucro)}</td>
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

function renderizarGrafico() {
  const canvas = document.getElementById('graficoBanca');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (estado.operacoes.length === 0) {
    ctx.fillStyle = '#8892a6';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados ainda', w / 2, h / 2);
    return;
  }

  const ops = estado.operacoes.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let saldo = estado.bancaInicial;
  const pontos = [saldo];
  ops.forEach(o => { saldo += o.valor; pontos.push(saldo); });

  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const range = max - min || 1;

  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pontos.forEach((p, i) => {
    const x = (i / (pontos.length - 1)) * (w - 40) + 20;
    const y = h - 20 - ((p - min) / range) * (h - 40);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderizarGraficoBarras() {
  const canvas = document.getElementById('graficoBarras');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const hoje = new Date();
  const ultimos30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const dataStr = d.toISOString().split('T')[0];
    const ops = operacoesDoDia(dataStr);
    ultimos30.push({ data: dataStr, resultado: resultadoPeriodo(ops) });
  }

  if (estado.operacoes.length === 0) {
    ctx.fillStyle = '#8892a6';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados ainda', w / 2, h / 2);
    return;
  }

  const valores = ultimos30.map(d => d.resultado);
  const maxAbs = Math.max(...valores.map(v => Math.abs(v)), 1);
  const alturaBarra = (h - 60) / 2;
  const larguraBarra = (w - 40) / 30 - 4;
  const linhaZero = h / 2;

  ctx.strokeStyle = '#2a3650';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, linhaZero);
  ctx.lineTo(w - 20, linhaZero);
  ctx.stroke();

  ultimos30.forEach((d, i) => {
    const x = 20 + i * ((w - 40) / 30) + 2;
    const altura = (Math.abs(d.resultado) / maxAbs) * alturaBarra;
    const y = d.resultado >= 0 ? linhaZero - altura : linhaZero;

    ctx.fillStyle = d.resultado > 0 ? '#00e676' : d.resultado < 0 ? '#ff5252' : '#2a3650';
    ctx.fillRect(x, y, larguraBarra, Math.max(altura, 2));
  });
}

// ==================== CALENDÁRIO ====================
function renderizarCalendario() {
  const grid = document.getElementById('calendarioGrid');
  const titulo = document.getElementById('tituloCalendario');
  if (!grid || !titulo) return;

  const ano = estado.anoCalendario;
  const mes = estado.mesCalendario;
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  titulo.textContent = `${nomesMes[mes]} ${ano}`;

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
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const ops = operacoesDoDia(dataStr);
    const resultado = resultadoPeriodo(ops);

    const el = document.createElement('div');
    el.className = 'cal-dia';
    if (ops.length > 0) {
      el.classList.add(resultado > 0 ? 'positivo' : resultado < 0 ? 'negativo' : '');
    }
    el.innerHTML = `
      <div class="cal-dia-num">${dia}</div>
      <div class="cal-dia-valor">${ops.length > 0 ? formatarMoeda(resultado) : ''}</div>
    `;
    grid.appendChild(el);
  }
}

// ==================== POR HORÁRIO ====================
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

// ==================== AÇÕES ====================
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
    tipo, ativo, valor: valorFinal, data, hora
  });

  salvar();
  document.getElementById('inputAtivo').value = '';
  document.getElementById('inputValor').value = '';
  renderizar();

  const emoji = tipo === 'WIN' ? '✅' : tipo === 'LOSS' ? '❌' : '➖';
  toast(`${emoji} ${tipo} registrado: ${formatarMoeda(Math.abs(valorFinal))}`, tipo === 'WIN' ? 'sucesso' : tipo === 'LOSS' ? 'erro' : 'info');
}

function removerOperacao(id) {
  if (!confirm('Remover esta operação?')) return;
  estado.operacoes = estado.operacoes.filter(o => o.id !== id);
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

  if (!confirm(`Registrar saque ${percentual}%?\n\nSaldo: ${formatarMoeda(banca)}\nSaque: ${formatarMoeda(valor)}`)) return;

  estado.saques.push({
    id: Date.now(),
    valor,
    data: hoje.toISOString().split('T')[0],
    tipo: percentual === 15 ? 'Quinzenal' : 'Mensal'
  });

  salvar();
  renderizar();
  toast(`💸 Saque registrado: ${formatarMoeda(valor)}`, 'sucesso');
}

function registrarDeposito() {
  const valor = parseFloat(document.getElementById('inputDeposito').value);
  const data = document.getElementById('inputDepositoData').value;
  const tipo = document.getElementById('inputDepositoTipo').value;

  if (isNaN(valor) || valor <= 0) return toast('Informe um valor válido.', 'erro');
  if (!data) return toast('Informe a data.', 'erro');

  if (tipo === 'DEPOSITO') {
    estado.depositos.push({ id: Date.now(), valor, data });
  } else {
    estado.saques.push({ id: Date.now(), valor, data, tipo: 'Manual' });
  }

  salvar();
  document.getElementById('inputDeposito').value = '';
  renderizar();
  toast(`${tipo === 'DEPOSITO' ? '💰 Depósito' : '💸 Saque'} registrado: ${formatarMoeda(valor)}`, 'sucesso');
}

// ==================== EVENTOS ====================
document.addEventListener('DOMContentLoaded', () => {
  carregar();
  renderizar();

  // NAVEGAÇÃO DE ABAS
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const el = document.getElementById('tab-' + tab);
      if (el) el.classList.add('active');
    });
  });

  // ALTERNAR ENTRADA
  const btnEnt = document.getElementById('btnAlternarEntrada');
  if (btnEnt) btnEnt.addEventListener('click', () => {
    estado.percentualEntrada = estado.percentualEntrada === 1 ? 10 : 1;
    salvar(); renderizar();
    toast(`Entrada alterada para ${estado.percentualEntrada}%`, 'info', 2000);
  });

  // OCULTAR
  const btnOc = document.getElementById('btnOcultar');
  if (btnOc) btnOc.addEventListener('click', () => {
    estado.ocultarValores = !estado.ocultarValores;
    salvar(); renderizar();
    toast(estado.ocultarValores ? '🔒 Valores ocultos' : '👁️ Valores visíveis', 'info', 2000);
  });

  // TEMA
  const btnTema = document.getElementById('btnTema');
  if (btnTema) btnTema.addEventListener('click', () => {
    estado.temaClaro = !estado.temaClaro;
    document.body.classList.toggle('light-mode', estado.temaClaro);
    document.getElementById('iconeTema').textContent = estado.temaClaro ? '☀️' : '🌙';
    salvar();
    toast(estado.temaClaro ? '☀️ Modo claro ativado' : '🌙 Modo escuro ativado', 'info', 2000);
  });

  // EXPORTAR
  const btnExp = document.getElementById('btnExportar');
  if (btnExp) btnExp.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ferrtrading-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Backup exportado!', 'sucesso');
  });

  // IMPORTAR
  const btnImp = document.getElementById('btnImportar');
  if (btnImp) btnImp.addEventListener('click', () => {
    document.getElementById('inputImportar').click();
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
          salvar();
          if (estado.temaClaro) document.body.classList.add('light-mode');
          else document.body.classList.remove('light-mode');
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

  // CALENDÁRIO NAV
  const btnAnt = document.getElementById('btnMesAnterior');
  if (btnAnt) btnAnt.addEventListener('click', () => {
    estado.mesCalendario--;
    if (estado.mesCalendario < 0) { estado.mesCalendario = 11; estado.anoCalendario--; }
    salvar();
    renderizarCalendario();
  });

  const btnProx = document.getElementById('btnProximoMes');
  if (btnProx) btnProx.addEventListener('click', () => {
    estado.mesCalendario++;
    if (estado.mesCalendario > 11) { estado.mesCalendario = 0; estado.anoCalendario++; }
    salvar();
    renderizarCalendario();
  });
});