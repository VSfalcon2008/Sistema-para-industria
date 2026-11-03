const API = '';
const toast = document.querySelector('#toast');
let toastTimer;
let currentUser = null;
let sharedData = {basic: [], financial: [], registration_requests: []};
function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const pageCopy = {
  inicio: ['Visão geral', 'Acompanhe a operação da sua indústria em tempo real.'],
  financeiro: ['Financeiro', 'Receitas, despesas, fluxo de caixa e rentabilidade da operação.'],
  vendas: ['Vendas', 'Pedidos, clientes, metas comerciais e desempenho de vendas.'],
  estoque: ['Estoque', 'Posição de materiais, movimentações e pontos de reposição.'],
  compras: ['Compras', 'Solicitações, cotações e acompanhamento de fornecedores.'],
  producao: ['Produção', 'Ordens de fabricação, produtividade e eficiência das linhas.'],
  pessoas: ['Pessoas', 'Equipes, departamentos, escalas e indicadores de produtividade.'],
  qualidade: ['Qualidade', 'Inspeções, não conformidades e planos de ação.'],
  relatorios: ['Relatórios', 'Análises consolidadas dos principais indicadores da empresa.'],
  configuracoes: ['Configurações', 'Ajuste unidades, usuários, permissões e preferências.'],
  usuarios: ['Usuários', 'Aprove solicitações de acesso e acompanhe os perfis da empresa.']
};
document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const key = link.dataset.page;
  const [title, subtitle] = pageCopy[key] || pageCopy.inicio;
  document.querySelector('#pageTitle').textContent = title;
  document.querySelector('#pageSubtitle').textContent = subtitle;
  document.querySelector('#crumb').textContent = title;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === key));
  document.querySelector('#sidebar').classList.remove('open');
  renderPage(key);
}));

document.querySelectorAll('.period').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.period').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const days = Number(button.dataset.period);
  document.querySelector('#dateSelect').value = days === 7 ? 'Últimos 7 dias' : days === 90 ? 'Últimos 90 dias' : days === 365 ? 'Últimos 90 dias' : 'Últimos 30 dias';
  notify(`Período atualizado: ${button.textContent}`);
}));
document.querySelector('#dateSelect').addEventListener('change', event => notify(`Filtro aplicado: ${event.target.value}`));
document.querySelector('#unitSelect').addEventListener('change', event => notify(`Unidade selecionada: ${event.target.value}`));
document.querySelector('#exportBtn').addEventListener('click', () => {
  const rows = [['Indicador','Valor'],['Faturamento','R$ 2.840.500'],['Lucro líquido','R$ 684.230'],['Pedidos em aberto','1.284'],['Eficiência produtiva','87,6%']];
  const csv = '\ufeff' + rows.map(row => row.join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); a.download = 'indicadores-industria-one.csv'; a.click(); URL.revokeObjectURL(a.href);
  notify('Relatório CSV exportado');
});
document.querySelector('#reportBtn').addEventListener('click', () => notify('Relatório demonstrativo criado'));

const panel = document.querySelector('#assistantPanel');
document.querySelector('#assistantToggle').addEventListener('click', () => panel.classList.remove('open'));
document.querySelector('#assistantFab').addEventListener('click', () => panel.classList.add('open'));
document.querySelector('#menuToggle').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelector('#refreshBtn').addEventListener('click', () => loadSharedData(true));
document.querySelector('#userSwitch').addEventListener('click', async () => {
  if (currentUser && location.protocol !== 'file:') await fetch('/api/logout', {method:'POST'}).catch(() => {});
  currentUser = null;
  document.querySelector('#authOverlay').classList.remove('hidden');
});
document.querySelector('#guestLogin').addEventListener('click', async () => {
  currentUser = {username:'', name:'Convidado', role:'guest'};
  document.querySelector('#authOverlay').classList.add('hidden');
  document.querySelector('#userSwitch').textContent = 'Convidado';
  document.querySelector('#topAvatar').textContent = 'C';
  await loadSharedData();
});
document.querySelector('#showRegister').addEventListener('click', () => {
  document.querySelector('#loginForm').hidden = true;
  document.querySelector('#registerForm').hidden = false;
});
document.querySelector('#showLogin').addEventListener('click', () => {
  document.querySelector('#registerForm').hidden = true;
  document.querySelector('#loginForm').hidden = false;
});
document.querySelector('#registerForm').addEventListener('submit', async event => {
  event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  const errorBox = document.querySelector('#registerError'); errorBox.textContent = '';
  try {
    const response = await fetch('/api/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a solicitação.');
    event.currentTarget.reset();
    document.querySelector('#registerForm').hidden = true;
    document.querySelector('#loginForm').hidden = false;
    notify('Solicitação enviada ao chefe para aprovação.');
  } catch (error) { errorBox.textContent = location.protocol === 'file:' ? 'Para solicitar acesso compartilhado, abra o sistema pelo endereço do servidor da empresa.' : error.message; }
});

function addMessage(text, who) {
  const body = document.querySelector('#chatBody');
  const item = document.createElement('div'); item.className = who === 'user' ? 'user-message' : 'assistant-message';
  if (who === 'user') {
    item.innerHTML = `<div class="user-bubble"></div>`;
    item.querySelector('.user-bubble').textContent = text;
  } else {
    item.innerHTML = '<div class="ai-avatar">✳</div><div class="message-content"></div>';
    item.querySelector('.message-content').textContent = text;
  }
  body.appendChild(item); body.scrollTop = body.scrollHeight;
}
async function askAssistant(question) {
  addMessage(question, 'user');
  try {
    if (location.protocol === 'file:') throw new Error('modo local');
    const response = await fetch(`${API}/api/assistant`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})});
    const data = await response.json();
    addMessage(data.answer, 'assistant');
  } catch {
    const q = question.toLowerCase();
    let answer = 'Posso ajudar com faturamento, lucro, produção e materiais abaixo do estoque mínimo. As respostas usam dados demonstrativos deste protótipo.';
    if (/estoque|material|acab|mínimo|minimo/.test(q)) answer = 'Alerta de estoque: o Aço carbono 1020 está com 120 kg disponíveis, abaixo do mínimo configurado de 200 kg. Recomendo abrir uma solicitação de compra. Resposta baseada nos dados demonstrativos.';
    else if (/produção|producao|eficiência|eficiencia|produtividade/.test(q)) answer = 'A eficiência produtiva demonstrativa é de 87,6%, com queda de 2,1% em relação ao período anterior. Foram produzidas 24.680 unidades no mês, frente à meta de 28.000.';
    else if (/fatur|receita|vendeu|vendas/.test(q)) answer = 'O faturamento demonstrativo do período é de R$ 2.840.500, 12,8% acima do período anterior.';
    else if (/lucro|margem|rentabilidade/.test(q)) answer = 'O lucro líquido demonstrativo é de R$ 684.230, com alta de 8,4% frente ao período anterior.';
    addMessage(answer, 'assistant');
  }
}
document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => askAssistant(button.dataset.question)));
document.querySelector('#chatForm').addEventListener('submit', event => {
  event.preventDefault(); const input = document.querySelector('#chatInput');
  const question = input.value.trim(); if (!question) return;
  input.value = ''; askAssistant(question);
});
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function formatBRL(value) { return Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}); }
async function loadSharedData(showNotice=false) {
  try {
    if (location.protocol === 'file:') throw new Error('offline');
    const response = await fetch('/api/data');
    if (response.status === 401) { document.querySelector('#authOverlay').classList.remove('hidden'); return; }
    if (!response.ok) throw new Error('api');
    sharedData = await response.json();
    document.querySelector('#syncStatus').textContent = 'Dados compartilhados';
  } catch {
    try { sharedData = JSON.parse(localStorage.getItem('industriaOneData') || '{"basic":[],"financial":[],"registration_requests":[]}'); }
    catch { sharedData = {basic:[],financial:[],registration_requests:[]}; }
    document.querySelector('#syncStatus').textContent = new URLSearchParams(location.search).get('modo') === 'demo' ? 'Demonstração pública' : location.protocol === 'file:' ? 'Modo local' : 'Sem conexão';
  }
  updateDashboard();
  const pendingCount = sharedData.registration_requests?.length || 0;
  document.querySelector('#pendingDot').hidden = !(currentUser?.role === 'chefe' && pendingCount);
  const active = document.querySelector('.nav-item.active')?.dataset.page || 'inicio';
  if (active !== 'inicio' && (showNotice || !document.querySelector('#recordForm'))) renderPage(active);
  if (showNotice) notify('Dados atualizados');
}
function updateDashboard() {
  const baseRevenue = 2840500, baseProfit = 684230;
  const revenue = (sharedData.financial || []).filter(r => r.category === 'Receita').reduce((sum,r)=>sum+(Number(r.value)||0),0);
  const expense = (sharedData.financial || []).filter(r => r.category === 'Despesa').reduce((sum,r)=>sum+(Number(r.value)||0),0);
  document.querySelector('#revenueValue').textContent = formatBRL(baseRevenue + revenue);
  document.querySelector('#profitValue').textContent = formatBRL(baseProfit + revenue - expense);
  const chart = document.querySelector('.line-chart');
  if (chart) {
    const xs = [0, 100, 200, 300, 400, 500, 600, 700];
    const revBase = [320, 355, 390, 470, 500, 560, 590, 640];
    const expBase = [180, 205, 220, 270, 300, 330, 365, 390];
    const revScale = 1 + revenue / baseRevenue;
    const expScale = 1 + expense / baseRevenue;
    const revValues = revBase.map(value => value * revScale);
    const expValues = expBase.map(value => value * expScale);
    const toY = value => Math.max(20, 210 - value * .27);
    const revD = revValues.map((value, i) => `${i ? 'L' : 'M'}${xs[i]} ${toY(value)}`).join(' ');
    const expD = expValues.map((value, i) => `${i ? 'L' : 'M'}${xs[i]} ${Math.max(25, 210 - value * .27)}`).join(' ');
    chart.querySelector('.revenue-line').setAttribute('d', revD);
    chart.querySelector('.expense-line').setAttribute('d', expD);
    chart.querySelector('.area').setAttribute('d', `${revD} L700 211 L0 211 Z`);
    const points = chart.querySelector('.chart-points');
    points.innerHTML = [1,3,5,7].map(i => `<circle cx="${xs[i]}" cy="${toY(revValues[i])}" r="4"/>`).join('');
  }
}
function renderPage(key) {
  const dashboard = document.querySelector('#dashboardView');
  const view = document.querySelector('#moduleView');
  if (key === 'inicio') { dashboard.hidden = false; view.hidden = true; return; }
  dashboard.hidden = true; view.hidden = false;
  const [title] = pageCopy[key] || pageCopy.inicio;
  if (key === 'usuarios') { renderUsersPage(view); return; }
  const financialPage = key === 'financeiro';
  const items = (financialPage ? (sharedData.financial || []) : (sharedData.basic || [])).filter(item => !item.module || item.module === key);
  const roleCanWrite = currentUser?.role === 'chefe';
  const canWrite = financialPage ? roleCanWrite : !!currentUser && currentUser.role !== 'guest';
  const form = canWrite ? `<form class="record-form" id="recordForm"><h3>${financialPage ? 'Registrar informação financeira' : `Adicionar informação · ${escapeHTML(title)}`}</h3><div class="record-fields">${financialPage ? `<label>Tipo<select name="category"><option>Receita</option><option>Despesa</option></select></label><label>Valor (R$)<input name="value" type="number" min="0.01" step="0.01" required placeholder="0,00"></label>` : `<label>Setor<input name="department" required placeholder="Ex.: Produção"></label>`}<label class="wide-field">Título<input name="title" required maxlength="120" placeholder="Resumo do registro"></label><label class="wide-field">Descrição<textarea name="description" rows="2" placeholder="Detalhes importantes"></textarea></label><label>Data<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><button class="btn btn-primary" type="submit">Salvar registro</button></div></form>` : `<div class="permission-note">${financialPage ? 'Apenas usuários com perfil chefe podem lançar informações financeiras.' : currentUser?.role === 'guest' ? 'Modo convidado: você pode visualizar os registros, mas não pode fazer alterações.' : 'Entre com seu usuário para adicionar informações.'}</div>`;
  const cards = financialPage ? `<div class="module-stats"><div><small>Receitas registradas</small><b>${formatBRL(items.filter(r=>r.category==='Receita').reduce((s,r)=>s+(Number(r.value)||0),0))}</b></div><div><small>Despesas registradas</small><b>${formatBRL(items.filter(r=>r.category==='Despesa').reduce((s,r)=>s+(Number(r.value)||0),0))}</b></div><div><small>Lançamentos</small><b>${items.length}</b></div></div>` : `<div class="module-stats"><div><small>Registros compartilhados</small><b>${items.length}</b></div><div><small>Perfil ativo</small><b>${currentUser ? (currentUser.role === 'chefe' ? 'Chefe' : 'Empregado') : 'Visitante'}</b></div><div><small>Sincronização</small><b>${location.protocol === 'file:' ? 'Neste navegador' : 'Servidor da empresa'}</b></div></div>`;
  const rows = items.length ? items.map(item => `<article class="record-row"><div class="record-type">${financialPage ? escapeHTML(item.category || 'Lançamento') : escapeHTML(item.department || title)}</div><div class="record-main"><b>${escapeHTML(item.title)}</b><p>${escapeHTML(item.description || 'Sem descrição')}</p><small>${escapeHTML(item.author || 'Usuário')} · ${escapeHTML(item.date || item.created_at || '')}</small></div>${financialPage ? `<strong class="record-value">${formatBRL(item.value)}</strong>` : ''}</article>`).join('') : '<div class="empty-state">Nenhuma informação registrada nesta seção ainda.</div>';
  view.innerHTML = `<section class="panel module-panel"><div class="panel-heading"><div><h2>${escapeHTML(title)}</h2><p>Informações sincronizadas para os usuários da empresa</p></div><button class="btn btn-quiet" id="moduleRefresh">⟳ Atualizar</button></div>${cards}${form}<div class="records-heading"><h3>Registros recentes</h3><span>${items.length} registro(s)</span></div><div class="record-list">${rows}</div></section>`;
  view.querySelector('#moduleRefresh')?.addEventListener('click', () => loadSharedData(true));
  view.querySelector('#recordForm')?.addEventListener('submit', saveRecord);
}
function renderUsersPage(view) {
  if (currentUser?.role !== 'chefe') {
    view.innerHTML = `<section class="panel module-panel"><div class="panel-heading"><div><h2>Usuários</h2><p>A gestão de acessos é restrita ao chefe.</p></div></div><div class="permission-note">${currentUser?.role === 'guest' ? 'Você está no modo convidado: pode consultar os resultados, sem fazer alterações.' : 'Entre com o perfil chefe para autorizar novos usuários.'}</div></section>`;
    return;
  }
  const requests = sharedData.registration_requests || [];
  const rows = requests.length ? requests.map(item => `<article class="request-row"><div class="request-avatar">${escapeHTML(item.name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase())}</div><div class="request-main"><b>${escapeHTML(item.name)}</b><p>@${escapeHTML(item.username)} · Solicitou acesso como empregado</p><small>Enviado em ${escapeHTML(item.created_at)}</small></div><div class="request-actions"><button class="btn btn-primary" data-auth-action="aprovar" data-id="${escapeHTML(item.id)}">Autorizar</button><button class="btn btn-quiet" data-auth-action="recusar" data-id="${escapeHTML(item.id)}">Recusar</button></div></article>`).join('') : '<div class="empty-state">Não há solicitações pendentes de aprovação.</div>';
  view.innerHTML = `<section class="panel module-panel"><div class="panel-heading"><div><h2>Solicitações de acesso</h2><p>Novos cadastros aguardam sua autorização antes de poderem entrar.</p></div><span class="alert-count">${requests.length}</span></div><div class="request-list">${rows}</div><div class="permission-note">Ao autorizar, o usuário recebe o perfil empregado: pode consultar os resultados compartilhados e adicionar informações básicas. Dados financeiros permanecem restritos ao chefe.</div></section>`;
  view.querySelectorAll('[data-auth-action]').forEach(button => button.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/users/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:button.dataset.id,action:button.dataset.authAction})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a solicitação.');
      await loadSharedData(); notify(result.message);
    } catch (error) { notify(location.protocol === 'file:' ? 'A aprovação compartilhada requer o servidor Python.' : error.message); }
  }));
}
async function saveRecord(event) {
  event.preventDefault();
  const key = document.querySelector('.nav-item.active')?.dataset.page;
  const form = event.currentTarget; const payload = {...Object.fromEntries(new FormData(form).entries()), module:key};
  try {
    if (location.protocol === 'file:') throw new Error('local');
    const response = await fetch(key === 'financeiro' ? '/api/financial' : '/api/basic', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
  } catch (error) {
    if (location.protocol !== 'file:') return notify(error.message);
    if (key === 'financeiro' && currentUser?.role !== 'chefe') return notify('Somente chefe pode registrar dados financeiros.');
    const target = key === 'financeiro' ? sharedData.financial : sharedData.basic;
    target.unshift({...payload, id:crypto.randomUUID(), author:currentUser?.name || 'Usuário', created_at:new Date().toISOString()});
    localStorage.setItem('industriaOneData', JSON.stringify(sharedData));
  }
  await loadSharedData(true); notify('Registro salvo e compartilhado');
}
document.querySelector('#loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const errorBox = document.querySelector('#authError'); errorBox.textContent = '';
  try {
    if (location.protocol === 'file:') {
      if (!['chefe','empregado'].includes(values.username.toLowerCase()) || values.password !== '123456') throw new Error('Usuário ou senha inválidos.');
      currentUser = {username:values.username.toLowerCase(),name:values.username.toLowerCase()==='chefe'?'Mariana Costa':'Colaborador',role:values.username.toLowerCase()};
    } else {
      const response = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Falha no login.'); currentUser = data.user;
    }
    document.querySelector('#authOverlay').classList.add('hidden');
    document.querySelector('#userSwitch').textContent = currentUser.name;
    document.querySelector('#topAvatar').textContent = currentUser.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
    await loadSharedData(); notify(`Bem-vindo(a), ${currentUser.name}`);
  } catch (error) { errorBox.textContent = error.message; }
});
async function initialize() {
  if (new URLSearchParams(location.search).get('modo') === 'demo') {
    currentUser = {username:'', name:'Convidado', role:'guest'};
    document.querySelector('#authOverlay').classList.add('hidden');
    document.querySelector('#userSwitch').textContent = 'Convidado';
    document.querySelector('#topAvatar').textContent = 'C';
    document.querySelector('#userSwitch').hidden = true;
    await loadSharedData();
    return;
  }
  if (location.protocol !== 'file:') {
    try { const response = await fetch('/api/me'); const data = await response.json(); if (data.user) { currentUser=data.user; document.querySelector('#authOverlay').classList.add('hidden'); document.querySelector('#userSwitch').textContent=currentUser.name; document.querySelector('#topAvatar').textContent=currentUser.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase(); } } catch {}
  }
  if (currentUser) await loadSharedData();
}
initialize();
setInterval(() => { if (currentUser && location.protocol !== 'file:') loadSharedData(); }, 30000);
