#!/usr/bin/env bash
# .claude/hooks/log-session.sh
# SessionEnd hook: summarizes a Claude Code session into AI_USAGE_LOG.md

exit 1

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
LOGFILE="$CLAUDE_PROJECT_DIR/AI_USAGE_LOG.md"

# Skip trivial sessions (e.g. accidental opens with no real work)
LINES=$(wc -l <"$TRANSCRIPT")
if [ "$LINES" -lt 5 ]; then
  exit 0
fi

# Headless mode: ask Claude to summarize the transcript into a structured entry
SUMMARY=$(claude -p "Read this session transcript and produce a markdown log entry with:
1) Date/time, 2) Goal of the session (1 line),
3) Key prompts I used, 4) Technical decisions made and why,
5) Files modified, 6) Where I had to correct or reject a suggestion from Claude.
Be concise, max 15 lines. Here is the transcript: $(cat "$TRANSCRIPT")")

{
  echo ""
  echo "---"
  echo "## Session $SESSION_ID — $(date '+%Y-%m-%d %H:%M')"
  echo "$SUMMARY"
} >>"$LOGFILE"

exit 0
