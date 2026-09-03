Claude Summary Viewer  (ClaudeMonitor)
======================================
by Matt Vale - MIT licensed (see LICENSE)

A local dashboard for every Claude Code conversation on your machine: usage
totals, per-conversation summaries, and a branch timeline of every tool the
assistant reached for per prompt.


How to run
----------
Windows:
  1. Double-click ClaudeMonitor.cmd.
  2. Your default browser opens at http://127.0.0.1:8439/
     (8439 = V-I-E-W on a phone keypad).
  3. To stop it: click Quit in the browser, press Ctrl+C in the console
     window, or just close that window.

macOS / Linux:
  1. chmod +x ClaudeMonitor.sh   (first time only)
  2. ./ClaudeMonitor.sh
  3. Same stop options as above.

You can also just run `node ClaudeMonitor.js` directly on any platform.


Requirements
------------
- Node.js (any reasonably recent version - https://nodejs.org/). No other
  dependencies; the server is plain Node stdlib.
- The Claude desktop app or Claude Code CLI installed and used at least once
  (that's what writes the transcript files this tool reads).
- Internet on first launch so the browser can fetch the Play/Fira Code fonts
  from Google Fonts. Cached after that.


How it works
------------
Everything runs locally. Nothing is uploaded.
- Conversations come from the JSONL transcripts Claude Code writes to
  ~/.claude/projects/<project-slug>/<session>.jsonl (same path shape on
  Windows, macOS and Linux).
- A tiny Node HTTP server (ClaudeMonitor.js) parses those files and serves
  the viewer HTML plus two JSON endpoints (/events.json, /usage.json).


The two pages
-------------
Summary (default)  - the dashboard: totals, tokens by category, cache
                     efficiency, model recommendation, "how could I use
                     less" opportunities, prompt-category breakdown, and
                     most-used tools. Scoped by whatever Source/Project/Show
                     filters are active in the header.

Conversations      - the drill-down. Three panels:
  - Left: filterable, groupable (by project), sortable list of conversations.
    Click a project header to collapse/expand its conversations.
  - Center: each conversation broken into individual prompt cards, latest
    first. Click a card to expand it and see: the full prompt text, a token
    breakdown (input / cache read / cache created / output / thinking), the
    branch timeline of tools used, and Claude's text response.
  - Right: details for whatever is selected (conversation, tool call, or
    the aggregate when nothing is selected).

Both pages share the header controls: Source, Project, Sort, Show (time
window), Font, Quit. The panel dividers are draggable and their widths
persist between sessions (localStorage).


Filters and sorting
-------------------
- Source (top bar):    All / Desktop app / Terminal CLI
- Project (top bar):   All projects, plus every distinct project detected
                       from each conversation's working directory. Sessions
                       run from a scratch/temp workspace show as "No folder".
- Sort (top bar):      Latest / Most tokens / Longest - controls the
                       sidebar and Summary page.
- Sort (canvas toolbar): a second, independent sort for the prompt cards
                       within the Conversations canvas.
- Show (top bar):      Today (default) / last 1h / 6h / 24h / 7d / all
                       history.

Every filter change updates the sidebar, canvas, detail panel AND Summary
page together.


The branch timeline
--------------------
Expanding a prompt card shows the tools used to answer it as a horizontal
timeline, one node per tool call in chronological order, color-coded by
category (Files, Shell, Search, Web, Task, Browser, MCP, Other). A legend
below shows each category's share of that prompt's decisions as a
percentage. Dashed/faded nodes are still in progress. Click a node for its
raw event data and the token usage of the turn that produced it.

The timeline defaults to scrolled all the way right (the latest action) and
keeps your scroll position across clicks/re-renders instead of resetting.


Model info
----------
Each conversation records which Claude model answered each turn:
- A chip next to each expanded prompt shows the model used (mixed models in
  one prompt show a "+N" badge).
- The sidebar meta line shows each conversation's primary model.
- The Summary page has a "Models" card with a heuristic recommendation
  (e.g. "your heaviest turns could use Opus") based on your own token/tool
  usage - not a guarantee, just a pointer.

Internal "<synthetic>" placeholder messages (zero-usage, not a real model
call) are filtered out automatically.


Files in this folder
---------------------
  ClaudeMonitor.js    The server. Plain Node, no dependencies.
  ClaudeMonitor.cmd   Windows launcher - double-click to run.
  ClaudeMonitor.sh    macOS/Linux launcher - chmod +x then run.
  viewer.html         The web UI. Edit and refresh - no server restart needed.
  LICENSE             MIT license.
  README.txt          This file.


Troubleshooting
----------------
- "Port already in use":  a previous instance is still bound to 8439. Open
                          http://127.0.0.1:8439/ and click Quit, or end the
                          node process from Task Manager / Activity Monitor.
- Nothing shows up:       use the Claude desktop app (or claude CLI) for at
                          least one conversation, then reload the viewer.
- "Node.js not found":    install it from https://nodejs.org/ and make sure
                          `node` is on your PATH, then relaunch.
