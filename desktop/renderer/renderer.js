const state = {
  status: null,
  logs: [],
  requests: [],
  filterErrors: false,
  filterLogErrors: false,
  editingRules: [],
};

const views = {
  dashboard: { title: '控制台首页', subtitle: '集中看状态、操作代理、快速排障。' },
  rules: { title: '规则与配置', subtitle: '图形化编辑基础配置和重映射规则。' },
  logs: { title: '日志中心', subtitle: '实时查看运行日志，定位转发问题。' },
  diagnostics: { title: '诊断工具', subtitle: '做健康检查和基础问题排查。' },
  about: { title: '关于', subtitle: '这版是桌面控制台骨架，面向后续打包 EXE。' },
};

function $(selector) { return document.querySelector(selector); }

function setView(viewName) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.dataset.view === viewName));
  $('#view-title').textContent = views[viewName].title;
  $('#view-subtitle').textContent = views[viewName].subtitle;
}

function fmt(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '未限制';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function appendEvent(event) {
  const container = $('#events');
  container.classList.remove('empty');
  const div = document.createElement('div');
  div.className = 'event-item';
  div.textContent = `[${event.time}] ${event.title}\n${event.detail}`;
  container.prepend(div);
  while (container.children.length > 20) container.removeChild(container.lastChild);
}

function createEmptyRule() {
  return {
    match: { host: '', port: '', protocol: 'https:', pathPrefix: '' },
    target: { host: '', port: '', protocol: 'https:', path: '' },
  };
}

function renderRulesPreview(config) {
  const el = $('#rules-list');
  const rules = config?.remapRules || [];
  if (!rules.length) {
    el.className = 'rule-list empty';
    el.textContent = '暂无规则。';
    return;
  }
  el.className = 'rule-list';
  el.innerHTML = '';
  rules.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.textContent = `规则 ${idx + 1}\n` + JSON.stringify(rule, null, 2);
    el.appendChild(item);
  });
}

function renderRuleEditor() {
  const root = $('#rules-editor');
  if (!state.editingRules.length) {
    root.className = 'rule-editor-list empty';
    root.textContent = '暂无规则。';
    return;
  }
  root.className = 'rule-editor-list';
  root.innerHTML = '';
  state.editingRules.forEach((rule, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'rule-editor-item';
    wrap.innerHTML = `
      <div class="section-head">
        <strong>规则 ${index + 1}</strong>
        <button class="danger" data-remove-rule="${index}">删除</button>
      </div>
      <div class="rule-editor-grid top-gap">
        <label>匹配 Host<input data-field="match.host" data-index="${index}" type="text" value="${rule.match.host || ''}" /></label>
        <label>匹配 Port<input data-field="match.port" data-index="${index}" type="number" value="${rule.match.port || ''}" /></label>
        <label>匹配协议
          <select data-field="match.protocol" data-index="${index}">
            <option value="">(不限制)</option>
            <option value="http:" ${rule.match.protocol === 'http:' ? 'selected' : ''}>http:</option>
            <option value="https:" ${rule.match.protocol === 'https:' ? 'selected' : ''}>https:</option>
          </select>
        </label>
        <label>路径前缀<input data-field="match.pathPrefix" data-index="${index}" type="text" value="${rule.match.pathPrefix || ''}" /></label>
        <label>目标 Host<input data-field="target.host" data-index="${index}" type="text" value="${rule.target.host || ''}" /></label>
        <label>目标 Port<input data-field="target.port" data-index="${index}" type="number" value="${rule.target.port || ''}" /></label>
        <label>目标协议
          <select data-field="target.protocol" data-index="${index}">
            <option value="">(沿用原协议)</option>
            <option value="http:" ${rule.target.protocol === 'http:' ? 'selected' : ''}>http:</option>
            <option value="https:" ${rule.target.protocol === 'https:' ? 'selected' : ''}>https:</option>
          </select>
        </label>
        <label>目标路径<input data-field="target.path" data-index="${index}" type="text" value="${rule.target.path || ''}" /></label>
      </div>
    `;
    root.appendChild(wrap);
  });
  root.querySelectorAll('[data-remove-rule]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.editingRules.splice(Number(btn.dataset.removeRule), 1);
      renderRuleEditor();
    });
  });
  root.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', event => {
      const index = Number(event.target.dataset.index);
      const [scope, key] = event.target.dataset.field.split('.');
      state.editingRules[index][scope][key] = event.target.value;
    });
  });
}

function renderLogs() {
  const el = $('#log-output');
  const list = state.filterLogErrors
    ? state.logs.filter(entry => entry.level === 'error' || entry.level === 'warn')
    : state.logs;
  el.textContent = list.map(entry => entry.line).join('\n');
  el.scrollTop = el.scrollHeight;
}

function renderRequests() {
  const tbody = $('#request-tbody');
  const list = state.filterErrors
    ? state.requests.filter(r => r.status === 'error' || r.status === 'forbidden')
    : state.requests;

  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无请求记录。</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  list.slice().reverse().forEach(req => {
    const tr = document.createElement('tr');
    const time = new Date(req.time).toLocaleTimeString('zh-CN');
    const method = req.method || '-';
    const from = req.from || '-';
    const to = req.to || '-';
    const statusClass = req.status === 'forwarded' ? 'status-ok' : req.status === 'forbidden' ? 'status-forbidden' : 'status-error';
    const statusText = req.status === 'forwarded' ? '转发成功' : req.status === 'forbidden' ? '禁止' : (req.error || '错误');
    const remapText = req.remapped ? '是' : '否';
    const duration = req.duration ? `${req.duration}ms` : '-';

    tr.innerHTML = `
      <td>${time}</td>
      <td>${method}</td>
      <td>${from}</td>
      <td>${to}</td>
      <td class="${statusClass}">${statusText}</td>
      <td class="${req.remapped ? 'remap-yes' : 'remap-no'}">${remapText}</td>
      <td>${duration}</td>
    `;
    tbody.appendChild(tr);
  });
}

function fillConfigForm(cfg) {
  $('#cfg-port').value = cfg.port || 8080;
  $('#cfg-host').value = cfg.host || '0.0.0.0';
  $('#cfg-log-level').value = cfg.logLevel || 'info';
  $('#cfg-connect-timeout').value = cfg.connectTimeoutMs || 15000;
  $('#cfg-request-timeout').value = cfg.requestTimeoutMs || 30000;
  $('#cfg-allowed-hosts').value = (cfg.allowedHosts || []).join(',');
}

function renderProxyStatus(processStatus, serviceHealth) {
  const card = $('#proxy-status-card');
  const icon = $('#proxy-status-icon');
  const text = $('#proxy-status-text');
  const hint = $('#proxy-status-hint');

  if (processStatus === 'running') {
    card.style.borderColor = 'var(--ok)';
    icon.textContent = '▶';
    text.textContent = '运行中';
    text.style.color = 'var(--ok)';
    hint.textContent = '代理正在监听请求';
  } else if (processStatus === 'starting') {
    card.style.borderColor = 'var(--warn)';
    icon.textContent = '⏳';
    text.textContent = '启动中';
    text.style.color = 'var(--warn)';
    hint.textContent = '正在初始化服务...';
  } else {
    card.style.borderColor = 'var(--line)';
    icon.textContent = '⏹';
    text.textContent = '已停止';
    text.style.color = 'var(--muted)';
    hint.textContent = '点击右侧按钮启动代理';
  }

  if (serviceHealth === 'healthy') {
    $('#service-status-pill').textContent = '服务状态：健康';
    $('#service-status-pill').style.borderColor = 'var(--ok)';
  } else if (serviceHealth === 'degraded') {
    $('#service-status-pill').textContent = '服务状态：异常';
    $('#service-status-pill').style.borderColor = 'var(--warn)';
  } else if (serviceHealth === 'down') {
    $('#service-status-pill').textContent = '服务状态：不可达';
    $('#service-status-pill').style.borderColor = 'var(--err)';
  } else {
    $('#service-status-pill').textContent = '服务状态：未知';
    $('#service-status-pill').style.borderColor = 'var(--line)';
  }

  $('#process-status-pill').textContent = `进程状态：${processStatus === 'stopped' ? '未启动' : (processStatus === 'starting' ? '启动中' : '已启动')}`;
}

function renderMappingRules(cfg) {
  const el = $('#mapping-rules');
  const rules = cfg?.remapRules || [];
  if (!rules.length) {
    el.className = 'mapping-rules empty';
    el.textContent = '暂无映射规则';
    return;
  }
  el.className = 'mapping-rules';
  el.innerHTML = '';
  rules.forEach((rule, idx) => {
    const m = rule.match || {};
    const t = rule.target || {};
    const from = `${m.protocol || 'https:'}//${m.host || '*'}:${m.port || '*'}${m.pathPrefix || ''}`;
    const to = `${t.protocol || ''}//${t.host}:${t.port || '*'}${t.path || ''}`;
    const div = document.createElement('div');
    div.textContent = `${from} → ${to}`;
    el.appendChild(div);
  });
}

function renderStatus(status) {
  state.status = status;
  state.logs = status.logs || state.logs;
  state.requests = status.requests || state.requests;
  const cfg = status.config || {};

  renderProxyStatus(status.processStatus, status.serviceHealth);

  $('#stat-port').textContent = cfg.port || '-';
  $('#stat-rules').textContent = String((cfg.remapRules || []).length);
  $('#stat-requests').textContent = String(state.requests.length);
  $('#stat-started').textContent = fmt(status.startedAt);

  renderMappingRules(cfg);
  fillConfigForm(cfg);
  state.editingRules = (cfg.remapRules || []).map(rule => JSON.parse(JSON.stringify(rule)));
  renderRuleEditor();
  renderRulesPreview(cfg);
  renderLogs();
  renderRequests();

  const events = status.events || [];
  const eventsContainer = $('#events');
  if (!events.length) {
    eventsContainer.className = 'event-list empty';
    eventsContainer.textContent = '还没有事件。';
  } else {
    eventsContainer.className = 'event-list';
    eventsContainer.innerHTML = '';
    events.slice(0, 20).forEach(appendEvent);
  }
}

async function refreshStatus() {
  const status = await window.bridgeConsole.getStatus();
  renderStatus(status);
}

async function runAction(fn, onSuccess) {
  try {
    const result = await fn();
    if (result?.processStatus || result?.config) renderStatus(result);
    if (onSuccess) onSuccess(result);
  } catch (err) {
    $('#diagnostics-output').textContent = `操作失败：${err.message}`;
  }
}

function buildPayloadFromForm() {
  return {
    port: Number($('#cfg-port').value || 8080),
    host: $('#cfg-host').value.trim() || '0.0.0.0',
    logLevel: $('#cfg-log-level').value,
    connectTimeoutMs: Number($('#cfg-connect-timeout').value || 15000),
    requestTimeoutMs: Number($('#cfg-request-timeout').value || 30000),
    allowedHosts: $('#cfg-allowed-hosts').value.split(',').map(s => s.trim()).filter(Boolean),
    remapRules: state.editingRules.map(rule => ({
      match: {
        ...(rule.match.host ? { host: rule.match.host.trim() } : {}),
        ...(rule.match.port ? { port: Number(rule.match.port) } : {}),
        ...(rule.match.protocol ? { protocol: rule.match.protocol } : {}),
        ...(rule.match.pathPrefix ? { pathPrefix: rule.match.pathPrefix.trim() } : {}),
      },
      target: {
        host: (rule.target.host || '').trim(),
        ...(rule.target.port ? { port: Number(rule.target.port) } : {}),
        ...(rule.target.protocol ? { protocol: rule.target.protocol } : {}),
        ...(rule.target.path ? { path: rule.target.path } : {}),
      },
    })),
  };
}

function wireActions() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => setView(item.dataset.view));
  });

  $('#btn-start').addEventListener('click', () => runAction(() => window.bridgeConsole.start()));
  $('#btn-stop').addEventListener('click', () => runAction(() => window.bridgeConsole.stop()));
  $('#btn-restart').addEventListener('click', () => runAction(() => window.bridgeConsole.restart()));
  $('#btn-open-config').addEventListener('click', () => runAction(() => window.bridgeConsole.openConfigDir()));
  $('#btn-open-env').addEventListener('click', () => runAction(() => window.bridgeConsole.openEnvFile()));
  $('#btn-reload-config').addEventListener('click', () => runAction(() => window.bridgeConsole.reloadConfig()));
  $('#btn-add-rule').addEventListener('click', () => {
    state.editingRules.push(createEmptyRule());
    renderRuleEditor();
  });
  $('#btn-save-config').addEventListener('click', async () => {
    const payload = buildPayloadFromForm();
    await runAction(() => window.bridgeConsole.saveConfig(payload), () => {
      $('#diagnostics-output').textContent = '配置已保存。';
    });
  });
  $('#btn-clear-logs').addEventListener('click', async () => {
    state.logs = [];
    renderLogs();
    await window.bridgeConsole.clearLogs();
  });
  $('#btn-clear-requests').addEventListener('click', async () => {
    state.requests = [];
    renderRequests();
    await window.bridgeConsole.clearRequests();
  });
  $('#filter-errors').addEventListener('change', event => {
    state.filterErrors = event.target.checked;
    renderRequests();
  });
  $('#filter-log-errors').addEventListener('change', event => {
    state.filterLogErrors = event.target.checked;
    renderLogs();
  });
  $('#btn-health-check').addEventListener('click', async () => {
    const result = await window.bridgeConsole.healthCheck();
    $('#diagnostics-output').textContent = JSON.stringify(result, null, 2);
    refreshStatus();
  });
  $('#btn-diagnostics').addEventListener('click', async () => {
    const result = await window.bridgeConsole.diagnostics();
    $('#diagnostics-output').textContent = JSON.stringify(result, null, 2);
    refreshStatus();
  });
  $('#btn-diagnostics-full').addEventListener('click', async () => {
    const result = await window.bridgeConsole.diagnostics();
    $('#diagnostics-output').textContent = JSON.stringify(result, null, 2);
    refreshStatus();
  });
  $('#btn-health-check-full').addEventListener('click', async () => {
    const result = await window.bridgeConsole.healthCheck();
    $('#diagnostics-output').textContent = JSON.stringify(result, null, 2);
    refreshStatus();
  });
}

window.bridgeConsole.onLog(entry => {
  state.logs.push(entry);
  if (state.logs.length > 1000) state.logs.shift();
  renderLogs();
});

window.bridgeConsole.onEvent(event => {
  appendEvent(event);
});

window.bridgeConsole.onRequest(req => {
  state.requests.push(req);
  if (state.requests.length > 2000) state.requests.shift();
  renderRequests();
});

window.bridgeConsole.onStatus(status => {
  renderStatus(status);
});

wireActions();
setView('dashboard');
refreshStatus();
