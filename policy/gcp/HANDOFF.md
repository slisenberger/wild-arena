# Handoff: GCP training session (peer session)

You are a second Claude Code session on Wild Arena whose job is **GCP training**. Another session (the "main"
session) owns verification, shipping to `main`, and repricing. Read `CLAUDE.md` first, then `policy/gcp/README.md`.

## Your job
1. Confirm the GCP credentials work.
2. Run the archetype sweep `policy/sweeps/m3_arch_s1.json` on GCP spot VMs: 20 runs, other-side cats, chargers,
   bulldozers, brawlers and kickers. GitHub Actions is busy until about 23:30 UTC with the v2 sweep for guards and
   harriers.
3. Collect the results and push them to a branch for the main session. **Don't ship anything**: don't change
   `policy/weights/*`, `policy/live.js`, prices, or `main`.

## Steps
```bash
git fetch origin && git checkout ccr-56c298de-g7h5w0 && git pull   # the branch with the GCP launcher + archetypes
node policy/gcp/gcp.js check          # env vars, key, auth, project, APIs, quota, bucket; each failure says what to fix
node policy/gcp/gcp.js check --vm     # also creates + deletes a tiny spot VM (~1 cent): proves launching works
```
If `check` fails on env vars, the secrets aren't in this session's environment. Tell the user: `GCP_PROJECT` and
`GCP_SA_KEY` (the whole service-account JSON) go in the environment settings, and they need a new session.

Then launch the sweep. Do a dry run first and read the cost line:
```bash
node policy/gcp/gcp.js launch policy/sweeps/m3_arch_s1.json --name=arch1 --dry-run
node policy/gcp/gcp.js launch policy/sweeps/m3_arch_s1.json --name=arch1 --yes
```
- Defaults: c2d-highcpu-112 spot VMs, 8 threads per run (14 runs per VM, so 2 VMs), at most 5.5 h.
- Estimate: under about $10. Training usually finishes in 1–3 h.
- If quota is low, `check` says so. Then use `--machine=n2d-highcpu-32` (4 runs per VM, more VMs) or ask the user to
  raise the spot-CPU quota.
- VMs clone the exact commit you launch from, so it must be pushed. It is if you didn't change anything.

Monitor every 15–30 minutes. Don't poll faster: runs checkpoint every 2 minutes and a generation takes a few minutes.
```bash
node policy/gcp/gcp.js status arch1   # pending / running / paused / done / failed / lost per run
node policy/gcp/gcp.js resume arch1 --yes   # after preemptions ('lost'), budget pauses ('paused'), or retryable failures
node policy/gcp/gcp.js stop arch1 --yes     # only if something is clearly wrong (states stay in the bucket)
```
- **lost:** preempted. Just resume; it continues exactly from its checkpoint.
- **failed:** read its note (the log tail). It's retried up to 3 times on resume. A failure that repeats is a bug:
  report it, don't patch training code blindly.
- **Stuck pending:** capacity. Resume tries other zones and smaller machines.

## When every run is done (or failed 3×)
```bash
node policy/gcp/gcp.js collect arch1      # -> policy/runs/gcp/arch1/<run>/{state.json,state.json.log,report.txt} + summary.txt
git checkout -b gcp/arch1
git add -f policy/runs/gcp/arch1 && git commit -m "GCP sweep arch1 (m3_arch_s1) results" && git push -u origin gcp/arch1
```
(`policy/runs/` is gitignored, hence `-f`.)

Then tell the user, in plain words:
- which runs beat their baseline on the 1,200 held-out test fights, and by how much (the `[test]` line per run in
  `summary.txt`)
- style scores and drift flags
- anything that failed and why
- total VM time and cost if you can see it

Point them to the `gcp/arch1` branch. The main session will check winners independently, review the behaviour for
realism, ship them as `policy/weights/<archetype>_v1.json`, and reprice.

## Context
- **Baselines.**
  - Warm runs (`--initRule=flankBusy`, `patient`, `hurtBack`) start from a hand-written rule; their test compares
    against zero weights (the heuristic).
  - Probe results:
    - bulldozer flankBusy +0.170 ± 0.030
    - brawler patient +0.067 ± 0.021
    - kicker and charger rules unconfirmed
    - cats have no headroom
- **Collapse.** A run that ends at exactly `0.000 ± 0.000` collapsed into "never deviate". That's a known failure
  mode, not a bug. The `--thetaClip` runs test the fix.
- **Opponents.** `--withLive=true`: the other archetypes use the shipped policies (harrier_v1, guard_v1) in every
  fight.
- **Harness checks.** If you touch the harness: `node policy/harness_test.js` (176 checks, about 19 minutes;
  `--full` runs all of them).
- **Git.** Commit on your own branch; never push to `main` or rewrite `ccr-56c298de-g7h5w0`.
