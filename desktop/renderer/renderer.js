const state = {
  status: null,
  logs: [],
  filterErrors: false,
  editingRules: [],
};

const views = {
  dashboard: {
    title: '控制台首页',
    subtitle: '集中看状态、操作代理、快速排障。',
  },
  rules: {
    title: '规则与配置',
    subtitle: '图形化编辑基础配置和重映射规则。',
  },
  logs: {
    title: '日志中心',
    subtitle: '实时查看运行日志，定位转发问题。',
  },
  diagnostics: {
    title: '诊断工具',
    subtitle: '做健康检查和基础问题排查。',
  },
  about: {
    title: '关于',
    subtitle: '这版是桌面控制台骨架，面向后续打包 EXE。',
  },
};

function $(selector) {
  return document.querySelector(selector);
}

function setView(viewName) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
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

  root.querySelectorAll('[data-remove-rule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editingRules.splice(Number(btn.dataset.removeRule), 1);
      renderRuleEditor();
    });
  });

  root.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const index = Number(event.target.dataset.index);
      const [scope, key] = event.target.dataset.field.split('.');
      state.editingRules[index][scope][key] = event.target.value;
    });
  });
}

function renderLogs() {
  const el = $('#log-output');
  const list = state.filterErrors
    ? state.logs.filter((entry) => entry.level === 'error' || entry.level === 'warn')
    : state.logs;
  el.textContent = list.map((entry) => entry.line).join('\n');
  el.scrollTop = el.scrollHeight;
}

function fillConfigForm(cfg) {
  $('#cfg-port').value = cfg.port || 8080;
  $('#cfg-host').value = cfg.host || '0.0.0.0';
  $('#cfg-log-level').value = cfg.logLevel || 'info';
  $('#cfg-connect-timeout').value = cfg.connectTimeoutMs || 15000;
  $('#cfg-request-timeout').value = cfg.requestTimeoutMs || 30000;
  $('#cfg-allowed-hosts').value = (cfg.allowedHosts || []).join(',');
}

function renderStatus(status) {
  state.status = status;
  state.logs = status.logs || state.logs;
  const cfg = status.config || {};

  $('#service-status-pill').textContent = `服务状态：${status.serviceHealth || 'unknown'}`;
  $('#process-status-pill').textContent = `进程状态：${status.processStatus || 'stopped'}`;
  $('#stat-listen').textContent = `${cfg.host || '-'}:${cfg.port || '-'}`;
  $('#stat-rules').textContent = String((cfg.remapRules || []).length);
  $('#stat-allowed').textContent = fmt(cfg.allowedHosts);
  $('#stat-started').textContent = fmt(status.startedAt);
  $('#summary-health').textContent = status.serviceHealth || 'unknown';
  $('#summary-url').textContent = fmt(status.listenUrl);
  $('#summary-env').textContent = fmt(status.envPath);
  $('#summary-error').textContent = fmt(status.lastError || '无');
  $('#config-summary').textContent = JSON.stringify(cfg, null, 2);

  fillConfigForm(cfg);
  state.editingRules = (cfg.remapRules || []).map((rule) => JSON.parse(JSON.stringify(rule)));
  renderRuleEditor();
  renderRulesPreview(cfg);
  renderLogs();

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
    allowedHosts: $('#cfg-allowed-hosts').value.split(',').map((s) => s.trim()).filter(Boolean),
    remapRules: state.editingRules.map((rule) => ({
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
  document.querySelectorAll('.nav-item').forEach((item) => {
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
  $('#filter-errors').addEventListener('change', (event) => {
    state.filterErrors = event.target.checked;
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
}

window.bridgeConsole.onLog((entry) => {
  state.logs.push(entry);
  if (state.logs.length > 1000) state.logs.shift();
  renderLogs();
});

window.bridgeConsole.onEvent((event) => {
  appendEvent(event);
});

window.bridgeConsole.onStatus((status) => {
  renderStatus(status);
});

wireActions();
setView('dashboard');
refreshStatus();
