# Claude Usage Monitor

**A local dashboard for every Claude Code conversation on your machine.**
Usage totals, per-conversation summaries, a branch timeline of every tool
the assistant reached for per prompt, and heuristic insights on how you
could use less.

Created by Matt Vale &middot; MIT licensed (see [LICENSE](LICENSE))

---

## How to run

### Windows

1. Double-click `ClaudeUsageMonitor.cmd`.
2. Your default browser opens at <http://127.0.0.1:8439/> &nbsp;
   *(8439 = V-I-E-W on a phone keypad.)*
3. To stop it: click **Quit** in the browser, press `Ctrl+C` in the console
   window, or close the window.

### macOS / Linux

```sh
chmod +x ClaudeUsageMonitor.sh   # first time only
./ClaudeUsageMonitor.sh
```

Or on any platform:

```sh
node ClaudeUsageMonitor.js
```

---

## Requirements

- **Node.js** (any reasonably recent version &mdash; <https://nodejs.org/>).
  No other dependencies; the server is plain Node stdlib.
- The **Claude desktop app** or **Claude Code CLI** installed and used at
  least once (that's what writes the transcript files this tool reads).
- Internet on first launch so the browser can fetch the Fira Code font
  from Google Fonts. Cached after that.

---

## How it works

Everything runs locally. Nothing is uploaded.

- Conversations come from the JSONL transcripts Claude Code writes to
  `~/.claude/projects/<project-slug>/<session>.jsonl` (same path shape on
  Windows, macOS and Linux).
- A tiny Node HTTP server (`ClaudeUsageMonitor.js`) parses those files and
  serves the viewer HTML plus two JSON endpoints (`/events.json`,
  `/usage.json`).

---

## The two pages

### Summary *(default)*

The dashboard: totals, tokens by category, a **Usage efficiency** score
with per-metric breakdown, model recommendation, an **opportunities**
panel of "how could I use less" suggestions, an aggregated
**Prompt insights** tally, a **What are you actually doing** activity
chart, worst-offending prompts (when a specific project is selected), and
most-used tools. Scoped by whatever Source / Project / Show filters are
active in the header.

### Conversations

The drill-down. Three panels:

- **Left** &mdash; filterable, groupable (by project), sortable list of
  conversations. Click a project header to collapse/expand its
  conversations.
- **Center** &mdash; each conversation broken into individual prompt cards,
  latest first. Click a card to expand it and see:
  - the full prompt text
  - a token breakdown (input / cache read / cache created / output / thinking)
  - the branch timeline of tools used
  - Claude's text response
  - a colour-coded tip if there's an insight worth acting on
- **Right** &mdash; details for whatever is selected (conversation, tool
  call, or the aggregate when nothing is selected).

Both pages share the header controls: **Source**, **Project**, **Sort**,
**Show** (time window), **Quit**. The panel dividers are draggable and
their widths persist between sessions (`localStorage`).

---

## Filters and sorting

| Filter | Options |
| --- | --- |
| **Source** | All &middot; Desktop app &middot; Terminal CLI |
| **Project** | All projects, plus every distinct project detected from each conversation's working directory. Sessions run from a scratch/temp workspace show as *No folder*. |
| **Sort** *(top bar)* | Latest &middot; Most tokens &middot; Longest &mdash; controls the sidebar and Summary page. |
| **Sort** *(canvas toolbar)* | A second, independent sort for the prompt cards within the Conversations canvas. |
| **Show** | Today *(default)* &middot; last 1h &middot; 6h &middot; 24h &middot; 7d &middot; all history |

Every filter change updates the sidebar, canvas, detail panel **and**
Summary page together.

---

## The branch timeline

Expanding a prompt card shows the tools used to answer it as a horizontal
timeline: one node per tool call in chronological order, colour-coded by
category (Files, Shell, Search, Web, Task, Browser, MCP, Other). A legend
below shows each category's share of that prompt's decisions as a
percentage. Dashed/faded nodes are still in progress. Click a node for a
tidy breakdown of the turn that produced it.

The timeline defaults to scrolled all the way right (the latest action)
and keeps your scroll position across clicks and re-renders instead of
resetting.

---

## Tokens: fresh vs total

Claude Code's `cache_read` tokens reflect the full growing context each
turn, so they can dwarf the actual new work on any given prompt. This
tool separates the two:

- **Total tokens** (input + output + cache created + cache read + thinking)
  &mdash; shown wherever a token count sits on its own (session totals,
  aggregate summary, "At a glance").
- **Fresh tokens** (input + output + cache created + thinking, **excludes
  cache read**) &mdash; shown next to action counts and used by the
  Usage efficiency score, so a small prompt inside a long conversation
  isn't misjudged as "context-heavy".

---

## Model info

Each conversation records which Claude model answered each turn:

- A chip next to each expanded prompt shows the model used (mixed models
  in one prompt show a `+N` badge).
- The sidebar meta line shows each conversation's primary model.
- The Summary page has a **Models** card with a heuristic recommendation
  (e.g. "your heaviest turns could use Opus") based on your own
  token/tool usage &mdash; not a guarantee, just a pointer.

Internal `<synthetic>` placeholder messages (zero-usage, not a real model
call) are filtered out automatically.

---

## Files in this folder

| File | What it is |
| --- | --- |
| `ClaudeUsageMonitor.js` | The server. Plain Node, no dependencies. |
| `ClaudeUsageMonitor.cmd` | Windows launcher &mdash; double-click to run. |
| `ClaudeUsageMonitor.sh` | macOS / Linux launcher &mdash; `chmod +x` then run. |
| `viewer.html` | The web UI. Edit and refresh &mdash; no server restart needed. |
| `LICENSE` | MIT license. |
| `README.md` | This file. |

---

## Troubleshooting

- **"Port already in use"** &mdash; a previous instance is still bound to
  8439. Open <http://127.0.0.1:8439/> and click **Quit**, or end the
  `node` process from Task Manager / Activity Monitor.
- **Nothing shows up** &mdash; use the Claude desktop app (or `claude`
  CLI) for at least one conversation, then reload the viewer.
- **"Node.js not found"** &mdash; install it from <https://nodejs.org/>
  and make sure `node` is on your `PATH`, then relaunch.
- **Console window doesn't close on Mac/Linux when you click Quit** &mdash;
  that's a terminal setting, not the script. In Terminal.app:
  *Settings &rarr; Profiles &rarr; Shell &rarr; When the shell exits &rarr;
  Close the window*. iTerm2: *Preferences &rarr; Profiles &rarr; Session
  &rarr; When the session ends &rarr; Close*.
