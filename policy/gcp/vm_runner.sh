#!/usr/bin/env bash
# Runs on each training VM (GCE startup script), and locally for tests (with BUCKET pointing at a folder).
# For every run assigned to this VM: restore its saved state from the bucket (a resumed run continues exactly where
# it stopped), train with a wall-clock budget, sync state + log + a status file to the bucket every SYNC_S seconds and
# at the end. A run that crashes is marked failed (with its log tail) and doesn't stop the others. When every run is
# finished the VM deletes itself (GCE). Statuses: running / done / failed (+ heartbeat time); "lost" is inferred by
# status.js from a stale heartbeat (preempted or dead VM).
set -uo pipefail
trap 'kill $(jobs -pr) 2>/dev/null; pkill -P $$ 2>/dev/null' EXIT TERM INT  # never leave a training process running unsynced
meta(){ curl -fs -H 'Metadata-Flavor: Google' "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1" 2>/dev/null; }
retry(){ local n=0; until "$@"; do n=$((n+1)); [ $n -ge 5 ] && return 1; sleep $((n*5)); done; }
LOCAL=${LOCAL:-0}
if [ "$LOCAL" = 1 ]; then : "${BUCKET:?}" "${SWEEP:?}" "${RUNS:?}" "${REPO_DIR:?}"; COMMIT=${COMMIT:-}; HOURS=${HOURS:-0.05}; THREADS=${THREADS:-2}; SYNC_S=${SYNC_S:-5}
else
  BUCKET=$(meta bucket); SWEEP=$(meta sweep); RUNS=$(meta runs); COMMIT=$(meta commit); HOURS=$(meta hours); THREADS=$(meta threads); SYNC_S=${SYNC_S:-120}
  REPO=$(meta repo); REPO_DIR=/opt/wild-arena
fi
# storage: gs://... via gcloud, or a local folder in tests
put(){ if [[ "$BUCKET" == gs://* ]]; then gcloud storage cp -q "$1" "$BUCKET/$2" >/dev/null 2>&1; else mkdir -p "$(dirname "$BUCKET/$2")" && cp "$1" "$BUCKET/$2"; fi; }
get(){ if [[ "$BUCKET" == gs://* ]]; then gcloud storage cp -q "$BUCKET/$1" "$2" >/dev/null 2>&1; else cp "$BUCKET/$1" "$2" 2>/dev/null; fi; }
status(){ # run state [note]
  local f; f=$(mktemp); printf '{"run":"%s","state":"%s","host":"%s","t":%s,"note":%s}\n' "$1" "$2" "$(hostname)" "$(date +%s)" "$(printf '%s' "${3:-}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(s.slice(-2000))))' 2>/dev/null || echo '""')" > "$f"
  put "$f" "sweeps/$SWEEP/status/$1.json"; rm -f "$f"; }
if [ "$LOCAL" != 1 ]; then
  export DEBIAN_FRONTEND=noninteractive
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    retry bash -c 'curl -fsSL https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.xz -o /tmp/node.tar.xz && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1' || { for r in ${RUNS//+/ }; do status "$r" failed "node install failed"; done; exit 1; }
  fi
  command -v git >/dev/null || retry apt-get install -y -q git
  retry git clone -q "$REPO" "$REPO_DIR" && git -C "$REPO_DIR" checkout -q "$COMMIT" || { for r in ${RUNS//+/ }; do status "$r" failed "git clone/checkout $COMMIT failed"; done; exit 1; }
fi
cd "$REPO_DIR"
get "sweeps/$SWEEP/manifest.json" /tmp/manifest.json || { echo "no manifest"; exit 1; }
pids=()
for r in ${RUNS//+/ }; do
  ( d="policy/runs/gcp/$r"; mkdir -p "$d"; f="$d/state.json"
    get "sweeps/$SWEEP/runs/$r/state.json" "$f" && get "sweeps/$SWEEP/runs/$r/state.json.log" "$f.log" || true   # resume if saved
    if [ ! -f "$f" ]; then
      args=$(node -e "const m=require('/tmp/manifest.json');const x=m.runs.find(q=>q.name===process.argv[1]);if(!x)process.exit(3);console.log(x.args)" "$r") || { status "$r" failed "not in manifest"; exit 0; }
      TR=policy/train.js; [[ " $args " == *" --trainer=ppo "* ]] && TR=policy/ppo_target.js   # milestone-4 PPO runs
      node $TR init "$f" $args > "$d/init.out" 2>&1 || { status "$r" failed "init: $(tail -c 1500 "$d/init.out")"; exit 0; }
    fi
    TR=policy/train.js; [ "$(node -p "require('./$f').config.trainer || ''" 2>/dev/null)" = ppo ] && TR=policy/ppo_target.js   # milestone-4 PPO runs (manifest args --trainer=ppo)
    status "$r" running "$(node $TR report "$f" 2>/dev/null | head -1)"
    node $TR run "$f" --threads="$THREADS" --hours="$HOURS" > "$d/run.out" 2>&1 & tp=$!
    while kill -0 $tp 2>/dev/null; do sleep "$SYNC_S"; [ -f "$f" ] && put "$f" "sweeps/$SWEEP/runs/$r/state.json"; [ -f "$f.log" ] && put "$f.log" "sweeps/$SWEEP/runs/$r/state.json.log"; status "$r" running "$(node $TR report "$f" 2>/dev/null | head -1)"; done
    wait $tp; rc=$?
    [ -f "$f" ] && put "$f" "sweeps/$SWEEP/runs/$r/state.json"; [ -f "$f.log" ] && put "$f.log" "sweeps/$SWEEP/runs/$r/state.json.log"; put "$d/run.out" "sweeps/$SWEEP/runs/$r/run.out"
    phase=$(node -p "require('./$f').phase" 2>/dev/null || echo '?')
    if [ $rc -ne 0 ]; then status "$r" failed "exit $rc: $(tail -c 1500 "$d/run.out")"
    elif [ "$phase" = done ]; then node $TR report "$f" > "$d/report.txt" 2>&1; put "$d/report.txt" "sweeps/$SWEEP/runs/$r/report.txt"; status "$r" done "$(grep '^test:' "$d/report.txt" | head -1)"
    else status "$r" running "time budget used (phase $phase); resume to continue"; fi   # out of time: resumable, not failed
  ) & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
if [ "$LOCAL" != 1 ]; then  # self-delete (the VM also has a hard max-run-duration as a backstop)
  name=$(curl -fs -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/name); zone=$(curl -fs -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/zone | sed 's#.*/##')
  retry gcloud compute instances delete "$name" --zone "$zone" --quiet || shutdown -h now
fi
