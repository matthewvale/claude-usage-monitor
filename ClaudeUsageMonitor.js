#!/usr/bin/env node
// Claude Usage Monitor - reads Claude Code's own transcript files and serves
// a live usage/decision dashboard over HTTP. No dependencies beyond Node's stdlib.
// Copyright (c) 2026 Matt Vale. MIT licensed - see LICENSE.
//
// Run:  node ClaudeUsageMonitor.js
// Or double-click ClaudeUsageMonitor.cmd (Windows) / run ClaudeUsageMonitor.sh (Mac/Linux).

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const PORT = 8439; // 8439 = V-I-E-W on a phone keypad.

// ---------------- transcript parsing -----------------------------------------

function tsFromTimestamp(o) {
  if (o.timestamp) {
    const t = Date.parse(o.timestamp);
    if (!Number.isNaN(t)) return t / 1000;
  }
  return 0;
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

// Map one Claude Code transcript row into zero or more viewer events.
function convertTranscriptLine(o) {
  const out = [];
  const ts = tsFromTimestamp(o);
  const sid = o.sessionId;
  if (!sid) return out;

  if (o.type === 'ai-title') {
    // The app's own short auto-generated conversation title.
    if (o.aiTitle) {
      out.push({
        ts, event: 'SessionTitle', session_id: sid,
        tool_name: null, tool_use_id: null, tool_input: null, prompt: null,
        title: o.aiTitle
      });
    }
  } else if (o.type === 'user') {
    const c = o.message ? o.message.content : null;
    if (typeof c === 'string') {
      const ep = o.entrypoint || null;
      const cwd = o.cwd || null;
      const isHuman = !!(o.origin && o.origin.kind === 'human');
      const noOrigin = !o.origin;
      // a real user prompt (skip the tool_result-only user messages)
      if (isHuman || noOrigin) {
        out.push({
          ts, event: 'UserPromptSubmit', session_id: sid,
          tool_name: null, tool_use_id: null, tool_input: null,
          prompt: c, entrypoint: ep, cwd
        });
      }
    } else if (Array.isArray(c)) {
      for (const b of c) {
        if (b && b.type === 'tool_result') {
          out.push({
            ts, event: 'PostToolUse', session_id: sid,
            tool_name: null, tool_use_id: b.tool_use_id || null,
            tool_input: null, prompt: null
          });
        }
      }
    }
  } else if (o.type === 'assistant') {
    const c = o.message ? o.message.content : null;
    let responseText = null;
    if (Array.isArray(c)) {
      const textParts = [];
      for (const b of c) {
        if (!b) continue;
        if (b.type === 'tool_use') {
          let ti = null;
          try { ti = JSON.stringify(b.input); } catch (e) { ti = String(b.input); }
          ti = truncate(ti, 240);
          out.push({
            ts, event: 'PreToolUse', session_id: sid,
            tool_name: b.name || null, tool_use_id: b.id || null,
            tool_input: ti, prompt: null
          });
        } else if (b.type === 'text' && b.text) {
          textParts.push(b.text);
        }
      }
      if (textParts.length) {
        // Cap length so a single huge reply can't bloat every /events.json poll.
        responseText = truncate(textParts.join('\n\n'), 12000);
      }
    }
    const u = o.message ? o.message.usage : null;
    const model = o.message ? (o.message.model || null) : null;
    // Skip Claude Code's internal "<synthetic>" placeholder messages - not a real
    // model call, always zero usage, just noise in any per-model breakdown.
    if (u && model !== '<synthetic>') {
      const thinking = (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0;
      out.push({
        ts, event: 'AssistantTurn', session_id: sid,
        tool_name: null, tool_use_id: null, tool_input: null, prompt: null,
        model,
        input_tokens: u.input_tokens || 0,
        output_tokens: u.output_tokens || 0,
        cache_creation: u.cache_creation_input_tokens || 0,
        cache_read: u.cache_read_input_tokens || 0,
        thinking_tokens: thinking,
        response_text: responseText,
        effort: o.effort || null
      });
    }
  }
  return out;
}

function getClaudeProjectsRoot() {
  // Same relative layout on every OS: ~/.claude/projects
  return path.join(os.homedir(), '.claude', 'projects');
}

function walkJsonlFiles(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
  }
}

const transcriptCache = new Map(); // filePath -> { mtimeMs, events }

function getTranscriptEvents() {
  const projRoot = getClaudeProjectsRoot();
  if (!fs.existsSync(projRoot)) return [];

  const files = [];
  walkJsonlFiles(projRoot, files);

  const all = [];
  for (const file of files) {
    let mtimeMs;
    try { mtimeMs = fs.statSync(file).mtimeMs; } catch (e) { continue; }

    const cached = transcriptCache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) {
      for (const e of cached.events) all.push(e);
      continue;
    }

    const events = [];
    let raw = '';
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { raw = ''; }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj;
      try { obj = JSON.parse(trimmed); } catch (e) { continue; }
      try {
        for (const ev of convertTranscriptLine(obj)) events.push(ev);
      } catch (e) { /* skip malformed row */ }
    }
    transcriptCache.set(file, { mtimeMs, events });
    for (const e of events) all.push(e);
  }

  all.sort((a, b) => a.ts - b.ts);
  return all;
}

function getEventsJson(hours) {
  let events = getTranscriptEvents();
  if (hours > 0) {
    const cutoff = Date.now() / 1000 - hours * 3600;
    events = events.filter(e => e.ts >= cutoff);
  }
  return JSON.stringify(events);
}

// ---------------- plan usage ---------------------------------------------------

// Every place the desktop app might keep plan-usage-history.json.
// On Windows the app ships two ways: a classic installer that writes to
// %APPDATA%\Claude, and a Microsoft Store / MSIX package that has its
// %APPDATA% writes redirected into the package's own LocalCache. The MSIX
// package name carries a publisher hash (Claude_pzs8sxrjxfjjc), so match on
// the prefix rather than hard-coding it.
function usageHistoryCandidates() {
  const out = [];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    out.push(path.join(appData, 'Claude', 'plan-usage-history.json'));

    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const pkgRoot = path.join(localAppData, 'Packages');
    let pkgs = [];
    try {
      pkgs = fs.readdirSync(pkgRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^Claude/i.test(d.name))
        .map(d => d.name);
    } catch (e) { /* no Packages dir - not a Store install */ }
    for (const pkg of pkgs) {
      out.push(path.join(pkgRoot, pkg, 'LocalCache', 'Roaming', 'Claude', 'plan-usage-history.json'));
    }
  } else if (process.platform === 'darwin') {
    out.push(path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'plan-usage-history.json'));
  } else {
    out.push(path.join(os.homedir(), '.config', 'Claude', 'plan-usage-history.json'));
  }
  return out;
}

// Returns the most recently written candidate, or null if none exist.
// Newest wins so that having both install flavours present still tracks
// whichever app the user is actually running.
function getUsageHistoryPath() {
  let best = null, bestMtime = -1;
  for (const p of usageHistoryCandidates()) {
    try {
      const st = fs.statSync(p);
      if (st.isFile() && st.mtimeMs > bestMtime) { bestMtime = st.mtimeMs; best = p; }
    } catch (e) { /* candidate absent */ }
  }
  return best;
}

function getUsageJson() {
  const p = getUsageHistoryPath();
  if (!p) return '{}';
  try {
    const raw = fs.readFileSync(p, 'utf8');
    // Regex-match the LAST sample record instead of parsing the whole (potentially
    // large) JSON - the samples array grows unbounded over time.
    const rx = /"t":(\d+)[^{}]*"u":\{"fh":(\d+),"sd":(\d+)\}/g;
    let m, last = null;
    while ((m = rx.exec(raw)) !== null) last = m;
    if (!last) return '{}';
    return JSON.stringify({
      fh: parseInt(last[2], 10),
      sd: parseInt(last[3], 10),
      ts: parseInt(last[1], 10) / 1000
    });
  } catch (e) {
    return '{}';
  }
}

// ---------------- viewer html ---------------------------------------------------

// Read fresh from disk on every request so edits to viewer.html are live -
// no server restart needed.
function getViewerHtml() {
  const p = path.join(__dirname, 'viewer.html');
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return '<!doctype html><meta charset="utf-8"><title>Claude Usage Monitor</title>' +
      '<body style="background:#0b0f14;color:#e6edf3;font:14px sans-serif;padding:24px">' +
      'viewer.html not found next to ClaudeUsageMonitor.js</body>';
  }
}

// ---------------- browser launch -------------------------------------------------

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    console.warn('Could not auto-open a browser - open ' + url + ' manually.');
  }
}

// ---------------- http server ----------------------------------------------------

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = u.pathname;
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET' && (pathname === '/' || pathname.startsWith('/index'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getViewerHtml());
    } else if (req.method === 'GET' && pathname.startsWith('/events.json')) {
      let hours = 6;
      const q = u.searchParams.get('hours');
      if (q !== null) {
        const v = parseFloat(q);
        if (!Number.isNaN(v)) hours = v;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(getEventsJson(hours));
    } else if (req.method === 'GET' && pathname.startsWith('/usage.json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(getUsageJson());
    } else if (req.method === 'POST' && pathname === '/quit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"bye":true}', () => {
        setTimeout(() => process.exit(0), 50);
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  } catch (err) {
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('error: ' + (err && err.message ? err.message : String(err)));
    } catch (e) { /* response already sent */ }
  }
});

server.on('error', (err) => {
  console.error(`Could not start listener on http://${HOST}:${PORT}/ - ${err.message} - port in use?`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('Claude Usage Monitor at ' + url);
  openBrowser(url);
});
