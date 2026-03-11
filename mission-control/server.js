import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const kanbanPath = path.join(dataDir, 'kanban.json');
const reviewsPath = path.join(dataDir, 'reviews.json');
const decisionTemplatePath = path.join(dataDir, 'decision-template.json');
const port = process.env.PORT || 3210;
let lastAuditAction = null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readKanban() {
  return readJson(kanbanPath);
}

async function writeKanban(board) {
  await writeFile(kanbanPath, JSON.stringify(board, null, 2) + '\n', 'utf8');
}

function computeScore(findings) {
  const weights = { critical: 30, warn: 10, info: 0 };
  let penalty = 0;
  for (const finding of findings) penalty += weights[finding.severity] ?? 5;
  return Math.max(0, 100 - penalty);
}

function scoreLabel(score) {
  if (score >= 90) return 'Solid';
  if (score >= 75) return 'Okay';
  if (score >= 60) return 'Shaky';
  return 'Needs attention';
}

async function runCommand(command) {
  const { stdout, stderr } = await exec(command, { cwd: path.join(__dirname, '..') });
  return { stdout, stderr };
}

function taskFromDecision(decision) {
  return {
    id: `task-${Date.now()}`,
    title: decision.title,
    description: decision.nextActions || decision.successLooksLike || decision.whyNow || '',
    priority: decision.priority || 'medium',
    owner: decision.owner || 'Barry Bot',
    roleLens: decision.roleLens || 'Barry Bot',
    deadline: decision.deadline || '',
    decisionMode: decision.decisionMode || 'stage-gate',
    strategyScore: decision.scores?.strategy ?? 3,
    technologyScore: decision.scores?.technology ?? 3,
    financeScore: decision.scores?.finance ?? 3,
    executionScore: decision.scores?.execution ?? 3
  };
}

async function getMissionControlData() {
  const [healthResult, auditResult, board, reviews, decisionTemplate] = await Promise.all([
    runCommand('openclaw health --json'),
    runCommand('openclaw security audit --json'),
    readKanban(),
    readJson(reviewsPath),
    readJson(decisionTemplatePath)
  ]);

  const health = JSON.parse(healthResult.stdout);
  const audit = JSON.parse(auditResult.stdout);
  const findings = audit.findings ?? [];
  const counts = findings.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, { critical: 0, warn: 0, info: 0 });

  const score = computeScore(findings);
  const session = health.agents?.[0]?.sessions?.recent?.[0] ?? null;
  const channelKeys = Object.keys(health.channels ?? {});
  const channels = channelKeys.map((key) => ({ key, ...(health.channels[key] || {}) }));

  return {
    generatedAt: new Date().toISOString(),
    status: {
      primaryModel: 'openai-codex/gpt-5.4',
      fallbackModel: 'none',
      gatewayReachable: health.gateway?.reachable ?? false,
      gatewayMode: health.gateway?.mode ?? 'unknown',
      defaultAgentId: health.defaultAgentId,
      activeSessions: health.sessions?.count ?? 0,
      latestSessionAgeMs: session?.age ?? null,
      heartbeatMinutes: Math.round((health.heartbeatSeconds ?? 0) / 60),
      channels
    },
    security: {
      score,
      label: scoreLabel(score),
      counts,
      issues: findings.filter((item) => item.severity !== 'info'),
      lastAuditAction
    },
    kanban: board,
    reviews,
    decisionTemplate
  };
}

async function runAuditAction(action) {
  const command = action === 'fix'
    ? 'openclaw security audit --fix --json'
    : 'openclaw security audit --json';

  try {
    const result = await runCommand(command);
    lastAuditAction = {
      action,
      ok: true,
      ranAt: new Date().toISOString(),
      output: result.stdout || result.stderr || 'Done.'
    };
    return lastAuditAction;
  } catch (error) {
    lastAuditAction = {
      action,
      ok: false,
      ranAt: new Date().toISOString(),
      output: error.stdout || error.stderr || error.message
    };
    return lastAuditAction;
  }
}

async function serveStatic(req, res) {
  const target = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, target);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const content = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/mission-control') {
      return sendJson(res, 200, await getMissionControlData());
    }

    if (req.method === 'PUT' && req.url === '/api/kanban') {
      try {
        const parsed = JSON.parse(await readRequestBody(req));
        await writeKanban(parsed);
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: error.message });
      }
    }

    if (req.method === 'POST' && req.url === '/api/decision-intake') {
      try {
        const decision = JSON.parse(await readRequestBody(req));
        const board = await readKanban();
        const column = decision.column || 'backlog';
        const task = taskFromDecision(decision);
        board.columns[column] = board.columns[column] || [];
        board.columns[column].unshift(task);
        await writeKanban(board);
        return sendJson(res, 200, { ok: true, task });
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: error.message });
      }
    }

    if (req.method === 'POST' && req.url === '/api/audit-action') {
      try {
        const { action } = JSON.parse(await readRequestBody(req));
        if (!['run', 'fix'].includes(action)) {
          return sendJson(res, 400, { ok: false, error: 'Invalid action' });
        }
        const result = await runAuditAction(action);
        return sendJson(res, 200, { ok: result.ok, result });
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: error.message });
      }
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Mission Control listening on http://localhost:${port}`);
});
