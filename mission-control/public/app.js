const columnLabels = {
  backlog: 'Backlog',
  inProgress: 'In Progress',
  blocked: 'Blocked',
  complete: 'Complete'
};

const orgRoles = {
  sim: {
    name: 'Sim', title: 'Principal / Owner', emoji: '👑', agentId: null,
    summary: 'Final authority on priorities, direction, budgets, and overrides.',
    owns: ['Direction', 'Approvals', 'Final decisions']
  },
  barry: {
    name: 'Barry Bot', title: 'Chief of Staff', emoji: 'BB', agentId: 'main',
    summary: 'Front door, coordinator, planner, and synthesizer across the executive team.',
    owns: ['Execution', 'Coordination', 'Planning']
  },
  mario: {
    name: 'Mario', title: 'CEO', emoji: '🎯', agentId: 'mario',
    summary: 'Long-term strategy, leverage, positioning, and sequencing.',
    owns: ['Strategy', 'Growth direction', 'Positioning']
  },
  elon: {
    name: 'Elon', title: 'CTO', emoji: '⚙️', agentId: 'elon',
    summary: 'First-principles technical thinking, systems, architecture, and automation.',
    owns: ['Architecture', 'Systems', 'Technical truth']
  },
  warren: {
    name: 'Warren', title: 'CFO', emoji: '💼', agentId: 'warren',
    summary: 'Cash flow stability, downside protection, durability, and financial discipline.',
    owns: ['Cash flow', 'Risk control', 'Durability']
  }
};

let missionData = null;
let autoRefreshTimer = null;
let draggedTaskId = null;
let activeRole = 'sim';

const statusStats = document.getElementById('statusStats');
const securityScore = document.getElementById('securityScore');
const securityCounts = document.getElementById('securityCounts');
const securityLabel = document.getElementById('securityLabel');
const issuesList = document.getElementById('issuesList');
const kanbanBoard = document.getElementById('kanbanBoard');
const executiveInbox = document.getElementById('executiveInbox');
const dispatchStatus = document.getElementById('dispatchStatus');
const orgChart = document.getElementById('orgChart');
const orgDetail = document.getElementById('orgDetail');
const refreshButton = document.getElementById('refreshButton');
const addTaskButton = document.getElementById('addTaskButton');
const taskDialog = document.getElementById('taskDialog');
const taskForm = document.getElementById('taskForm');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const runAuditButton = document.getElementById('runAuditButton');
const fixAuditButton = document.getElementById('fixAuditButton');
const auditOutput = document.getElementById('auditOutput');
const lastUpdated = document.getElementById('lastUpdated');
const weeklyReview = document.getElementById('weeklyReview');
const consultForm = document.getElementById('consultForm');
const consultButton = document.getElementById('consultButton');
const consultResults = document.getElementById('consultResults');
const advisoryRouting = document.getElementById('advisoryRouting');

function ageText(ms) {
  if (!ms && ms !== 0) return 'n/a';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function roleStatus(roleKey) {
  const role = orgRoles[roleKey];
  if (!missionData?.executiveInbox?.length || !role.agentId) return { label: role.agentId ? 'idle' : 'human', className: role.agentId ? 'idle' : 'human' };
  const hit = missionData.executiveInbox.find((item) => item.agentId === role.agentId);
  if (!hit) return { label: role.agentId === 'main' ? 'front door' : 'idle', className: role.agentId === 'main' ? 'active' : 'idle' };
  return { label: 'active', className: 'active' };
}

function renderStatus(status) {
  const channelSummary = status.channels.map((channel) => {
    const live = channel.connected === true ? 'connected' : channel.linked ? 'linked' : 'offline';
    return `${channel.key} (${live})`;
  }).join(', ') || 'none';

  const items = [
    ['Primary model', status.primaryModel],
    ['Fallback model', status.fallbackModel],
    ['Gateway', status.gatewayReachable ? `Reachable (${status.gatewayMode})` : 'Offline'],
    ['Agent', status.defaultAgentId || 'n/a'],
    ['Active sessions', status.activeSessions],
    ['Latest session', ageText(status.latestSessionAgeMs)],
    ['Heartbeat', `${status.heartbeatMinutes} min`],
    ['Channels', channelSummary]
  ];

  statusStats.innerHTML = items.map(([label, value]) => `
    <div class="stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join('');
}

function renderReview(reviews) {
  const review = reviews.weeklyExecReview;
  weeklyReview.innerHTML = `
    <div class="review-box">
      <div class="review-chips">
        <span class="chip">Cadence: ${review.cadence}</span>
        <span class="chip">5-part review</span>
      </div>
      <div>
        <strong>Agenda</strong>
        <ul>${review.agenda.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div>
        <strong>Checkpoints</strong>
        <ul>${review.checkpoints.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

function renderOrgChart() {
  const node = (key) => {
    const role = orgRoles[key];
    const status = roleStatus(key);
    return `<button class="org-node ${activeRole === key ? 'active' : ''}" data-org-role="${key}" data-drop-role="${key}">
      <div class="org-emoji">${role.emoji}</div>
      <span>${role.name}</span>
      <small>${role.title}</small>
      <div class="node-status ${status.className}">${status.label}</div>
    </button>`;
  };

  orgChart.innerHTML = `
    <div class="org-top">${node('sim')}</div>
    <div class="org-tree-lines">
      <div class="vertical-line"></div>
      <div class="horizontal-line"></div>
    </div>
    <div class="org-row">
      ${node('barry')}
      ${node('mario')}
      ${node('elon')}
      ${node('warren')}
    </div>
  `;

  document.querySelectorAll('[data-org-role]').forEach((button) => {
    button.addEventListener('click', () => {
      activeRole = button.dataset.orgRole;
      renderOrgChart();
      renderOrgDetail();
    });
  });

  document.querySelectorAll('[data-drop-role]').forEach((nodeEl) => {
    nodeEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      nodeEl.classList.add('drag-over');
    });
    nodeEl.addEventListener('dragleave', () => nodeEl.classList.remove('drag-over'));
    nodeEl.addEventListener('drop', async (event) => {
      event.preventDefault();
      nodeEl.classList.remove('drag-over');
      if (!draggedTaskId) return;
      await assignTaskToRole(draggedTaskId, nodeEl.dataset.dropRole);
    });
  });
}

function renderOrgDetail() {
  const role = orgRoles[activeRole];
  const agentActions = role.agentId && role.agentId !== 'main'
    ? `<div class="inline-actions">
         <button class="secondary-button" data-org-consult="${role.agentId}">Ask ${role.name}</button>
         <button class="secondary-button" data-org-create-task="${role.name}">Create task for ${role.name}</button>
       </div>`
    : `<div class="inline-actions">
         <button class="secondary-button" data-org-create-task="${role.name}">Create task for ${role.name}</button>
       </div>`;

  orgDetail.innerHTML = `
    <div class="review-box">
      <div class="review-chips">
        <span class="chip">${role.emoji}</span>
        <span class="chip">${role.title}</span>
        ${role.agentId ? `<span class="chip">agent: ${role.agentId}</span>` : '<span class="chip">human principal</span>'}
      </div>
      <p>${role.summary}</p>
      <div>
        <strong>Owns</strong>
        <ul>${role.owns.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
      <p class="subtle">Tip: drag a Kanban card onto a role node to assign ownership and lens.</p>
      ${agentActions}
    </div>
  `;

  document.querySelectorAll('[data-org-consult]').forEach((button) => {
    button.addEventListener('click', () => {
      const prompt = `Give Sim a concise ${role.title} take on the current priorities and biggest next move.`;
      consultSingleExecutive(button.dataset.orgConsult, prompt);
    });
  });

  document.querySelectorAll('[data-org-create-task]').forEach((button) => {
    button.addEventListener('click', () => {
      taskForm.reset();
      taskForm.querySelector('[name="owner"]').value = button.dataset.orgCreateTask;
      taskForm.querySelector('[name="roleLens"]').value = button.dataset.orgCreateTask === 'Barry Bot' ? 'Barry Bot' : button.dataset.orgCreateTask;
      taskDialog.showModal();
    });
  });
}

function renderConsult(data) {
  const route = data.advisoryRouting;
  advisoryRouting.innerHTML = `
    <div class="review-box">
      <strong>Direct agent route</strong>
      <ul>${route.notes.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `;

  if (!data.executiveConsult) {
    consultResults.textContent = 'No executive consult run yet.';
    return;
  }

  consultResults.innerHTML = `
    <div class="review-box">
      <div class="review-chips">
        <span class="chip">Ran ${formatTime(data.executiveConsult.ranAt)}</span>
      </div>
      <p><strong>Prompt:</strong> ${data.executiveConsult.prompt}</p>
      ${data.executiveConsult.results.map((result) => `
        <div class="consult-result ${result.ok ? '' : 'failed'}">
          <strong>${result.perspective} · ${result.agentId}</strong>
          <pre class="audit-output">${result.output || 'No output.'}</pre>
        </div>
      `).join('')}
    </div>
  `;
}

function renderInbox(items) {
  if (!items?.length) {
    executiveInbox.innerHTML = '<p class="subtle">No executive sessions yet.</p>';
    return;
  }

  executiveInbox.innerHTML = items.map((item) => `
    <article class="inbox-item">
      <strong>${item.agentId}</strong>
      <div class="subtle">${item.key || 'session'} · ${item.model || 'unknown model'}</div>
      <div class="subtle">Updated: ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'n/a'}</div>
    </article>
  `).join('');
}

function renderDispatch(dispatch) {
  if (!dispatch) {
    dispatchStatus.textContent = 'No executive dispatch yet.';
    return;
  }

  dispatchStatus.innerHTML = `
    <div class="review-box">
      <div class="review-chips">
        <span class="chip">${dispatch.agentId}</span>
        <span class="chip">${dispatch.taskTitle}</span>
        <span class="chip">${formatTime(dispatch.ranAt)}</span>
      </div>
      <pre class="audit-output">${dispatch.result?.output || 'No output.'}</pre>
    </div>
  `;
}

function renderSecurity(security) {
  securityScore.textContent = security.score;
  securityLabel.textContent = `${security.label} · ${security.issues.length} open issue(s)`;
  securityCounts.innerHTML = [
    ['critical', security.counts.critical || 0],
    ['warn', security.counts.warn || 0],
    ['info', security.counts.info || 0]
  ].map(([level, count]) => `<span class="chip">${level}: ${count}</span>`).join('');

  if (security.lastAuditAction) {
    const badge = security.lastAuditAction.ok ? 'OK' : 'FAILED';
    auditOutput.textContent = `[${badge}] ${security.lastAuditAction.action} · ${formatTime(security.lastAuditAction.ranAt)}\n\n${security.lastAuditAction.output}`;
  } else {
    auditOutput.textContent = 'No audit action run yet.';
  }

  if (!security.issues.length) {
    issuesList.innerHTML = '<div class="issue"><strong>No open security issues.</strong></div>';
    return;
  }

  issuesList.innerHTML = security.issues.map((issue) => `
    <article class="issue ${issue.severity}">
      <div class="title-row">
        <strong>${issue.title}</strong>
        <span class="chip">${issue.severity}</span>
      </div>
      <p>${issue.detail}</p>
      <p><strong>Fix:</strong> ${issue.remediation}</p>
    </article>
  `).join('');
}

function taskMeta(task) {
  return `
    <div class="task-meta">
      <span class="chip owner">Owner: ${task.owner || 'n/a'}</span>
      <span class="chip lens">Lens: ${task.roleLens || 'n/a'}</span>
      <span class="chip mode">${task.decisionMode || 'task'}</span>
      ${task.deadline ? `<span class="chip">Due: ${task.deadline}</span>` : ''}
    </div>
  `;
}

function executiveButtons(taskId) {
  return `
    <div class="exec-actions">
      <button class="secondary-button" data-send-task="${taskId}" data-agent="mario">Send to Mario</button>
      <button class="secondary-button" data-send-task="${taskId}" data-agent="elon">Send to Elon</button>
      <button class="secondary-button" data-send-task="${taskId}" data-agent="warren">Send to Warren</button>
    </div>
  `;
}

function taskCard(task, columnKey) {
  const moveTargets = Object.keys(columnLabels).filter((key) => key !== columnKey);
  return `
    <article class="task" draggable="true" data-task-id="${task.id}">
      <h4>${task.title}</h4>
      ${taskMeta(task)}
      <p>${task.description || ''}</p>
      ${executiveButtons(task.id)}
      <div class="task-footer">
        <span class="priority">${task.priority || 'medium'}</span>
        <div class="task-actions">
          ${moveTargets.map((target) => `<button data-move-task="${task.id}" data-target-column="${target}">${columnLabels[target]}</button>`).join('')}
        </div>
      </div>
    </article>
  `;
}

function bindTaskEvents() {
  document.querySelectorAll('[data-move-task]').forEach((button) => {
    button.addEventListener('click', async () => {
      await moveTask(button.dataset.moveTask, button.dataset.targetColumn);
    });
  });

  document.querySelectorAll('[data-send-task]').forEach((button) => {
    button.addEventListener('click', async () => {
      await sendTaskToExecutive(button.dataset.taskId, button.dataset.agent);
    });
  });

  document.querySelectorAll('.task').forEach((taskEl) => {
    taskEl.addEventListener('dragstart', () => {
      draggedTaskId = taskEl.dataset.taskId;
      taskEl.classList.add('dragging');
    });
    taskEl.addEventListener('dragend', () => {
      draggedTaskId = null;
      taskEl.classList.remove('dragging');
    });
  });

  document.querySelectorAll('.column').forEach((columnEl) => {
    columnEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      columnEl.classList.add('drag-over');
    });
    columnEl.addEventListener('dragleave', () => {
      columnEl.classList.remove('drag-over');
    });
    columnEl.addEventListener('drop', async (event) => {
      event.preventDefault();
      columnEl.classList.remove('drag-over');
      if (draggedTaskId) await moveTask(draggedTaskId, columnEl.dataset.columnKey);
    });
  });
}

function renderKanban(board) {
  kanbanBoard.innerHTML = Object.entries(columnLabels).map(([key, label]) => `
    <section class="column" data-column-key="${key}">
      <h3>${label}</h3>
      <div class="column-body">
        ${(board.columns[key] || []).map((task) => taskCard(task, key)).join('') || '<p class="subtle">Nothing here.</p>'}
      </div>
    </section>
  `).join('');
  bindTaskEvents();
}

async function fetchData({ silent = false } = {}) {
  if (!silent) refreshButton.disabled = true;
  try {
    const response = await fetch('/api/mission-control');
    missionData = await response.json();
    lastUpdated.textContent = `Updated ${formatTime(missionData.generatedAt)}`;
    renderStatus(missionData.status);
    renderSecurity(missionData.security);
    renderReview(missionData.reviews);
    renderOrgChart();
    renderOrgDetail();
    renderConsult(missionData);
    renderInbox(missionData.executiveInbox);
    renderDispatch(missionData.executiveDispatch);
    renderKanban(missionData.kanban);
  } finally {
    refreshButton.disabled = false;
  }
}

async function saveKanban() {
  await fetch('/api/kanban', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(missionData.kanban)
  });
}

function findTask(taskId) {
  for (const key of Object.keys(missionData.kanban.columns)) {
    const found = missionData.kanban.columns[key].find((task) => task.id === taskId);
    if (found) return found;
  }
  return null;
}

async function assignTaskToRole(taskId, roleKey) {
  const task = findTask(taskId);
  const role = orgRoles[roleKey];
  if (!task || !role) return;
  task.owner = role.name;
  task.roleLens = role.name === 'Barry Bot' ? 'Barry Bot' : role.name;
  await saveKanban();
  renderKanban(missionData.kanban);
  activeRole = roleKey;
  renderOrgChart();
  renderOrgDetail();
}

async function moveTask(taskId, targetColumn) {
  const columns = missionData.kanban.columns;
  let taskToMove = null;
  for (const key of Object.keys(columns)) {
    const idx = columns[key].findIndex((task) => task.id === taskId);
    if (idx >= 0) {
      taskToMove = columns[key][idx];
      columns[key].splice(idx, 1);
      break;
    }
  }
  if (!taskToMove) return;
  columns[targetColumn].unshift(taskToMove);
  await saveKanban();
  renderKanban(missionData.kanban);
}

async function runAuditAction(action) {
  const button = action === 'fix' ? fixAuditButton : runAuditButton;
  button.disabled = true;
  auditOutput.textContent = `${action === 'fix' ? 'Applying safe fixes' : 'Running audit'}...`;
  try {
    const response = await fetch('/api/audit-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const result = await response.json();
    if (!result.ok) auditOutput.textContent = result.error || 'Action failed.';
    await fetchData();
  } finally {
    button.disabled = false;
  }
}

async function runExecutiveConsult(event) {
  event.preventDefault();
  const prompt = new FormData(consultForm).get('prompt');
  consultButton.disabled = true;
  consultResults.textContent = 'Consulting Mario / Elon / Warren...';
  try {
    await fetch('/api/executive-consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    await fetchData();
  } finally {
    consultButton.disabled = false;
  }
}

async function consultSingleExecutive(agentId, prompt) {
  consultButton.disabled = true;
  consultResults.textContent = `Consulting ${agentId}...`;
  try {
    await fetch('/api/executive-consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    await fetchData();
  } finally {
    consultButton.disabled = false;
  }
}

async function sendTaskToExecutive(taskId, agentId) {
  dispatchStatus.textContent = `Sending task to ${agentId}...`;
  await fetch('/api/executive-dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, agentId })
  });
  await fetchData();
}

function syncAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  if (autoRefreshToggle.checked) autoRefreshTimer = setInterval(() => fetchData({ silent: true }), 30000);
}

refreshButton.addEventListener('click', () => fetchData());
autoRefreshToggle.addEventListener('change', syncAutoRefresh);
runAuditButton.addEventListener('click', () => runAuditAction('run'));
fixAuditButton.addEventListener('click', () => runAuditAction('fix'));
addTaskButton.addEventListener('click', () => {
  taskForm.reset();
  taskDialog.showModal();
});
consultForm.addEventListener('submit', runExecutiveConsult);

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const task = {
    id: `task-${Date.now()}`,
    title: formData.get('title'),
    description: formData.get('description'),
    priority: formData.get('priority'),
    owner: formData.get('owner'),
    roleLens: formData.get('roleLens')
  };
  const column = formData.get('column');
  missionData.kanban.columns[column].unshift(task);
  await saveKanban();
  renderKanban(missionData.kanban);
  taskDialog.close();
});

syncAutoRefresh();
fetchData();
