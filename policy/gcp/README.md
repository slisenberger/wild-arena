# Training on GCP spot VMs

`policy/gcp/gcp.js` runs a sweep file (same format as `policy/sweeps/*.json` for GitHub Actions) on spot VMs. Each VM
packs several runs (`--threads` cores each), checkpoints every run to a bucket every 2 minutes, and deletes itself when
done. Everything is resumable: `train.js` saves after every step and refuses to continue on a different engine.

## Setup (once)
Environment variables: `GCP_PROJECT`, `GCP_SA_KEY` (service-account JSON; secret; optional if gcloud is already logged in, e.g. a
proxy-injected token), optional `GCP_REGION` (us-central1; a comma list such as `us-central1,us-east1` spills VMs into the next
region: new projects allow only 8 external IPs, i.e. 8 VMs, per region), `GCS_XML_READ=1` (read the bucket over the XML API, for
proxies that decode `%2F` and break `gcloud storage cat`),
`GCP_BUCKET` (gs://<project>-wild-arena-runs, created on first use), `GCP_VM_SA` (service account for the VMs).
The service account needs Compute Instance Admin (v1), Service Account User and Storage Admin. Spot vCPU quota in the
region (~200 for two 112-core VMs). VMs clone the public repo at the exact commit, so push before launching.

## Commands
```
node policy/gcp/gcp.js check [--vm]     # verify env vars, key, auth, APIs, quota, bucket (and a tiny spot VM with --vm)
node policy/gcp/gcp.js launch  policy/sweeps/m3_v2.json [--name=ID] [--machine=c2d-highcpu-112] [--threads=8] [--hours=5.5] --yes   (--dry-run prints the gcloud commands)
node policy/gcp/gcp.js status  ID        # pending / running / paused / done / failed / lost, with heartbeat age and last report line
node policy/gcp/gcp.js resume  ID --yes  # relaunch everything not done (from checkpoints); failed runs retried up to --maxRetries=3
node policy/gcp/gcp.js stop    ID --yes  # delete every VM of the sweep (states stay in the bucket)
node policy/gcp/gcp.js collect ID        # states/logs/reports -> policy/runs/gcp/ID/ + summary.txt
```

## Failure handling
| failure | what happens |
|---|---|
| spot preemption / VM dies | heartbeat goes stale (20 min) → `lost`; `resume` continues each run from its last checkpoint (exact) |
| no capacity / quota in a zone | next zone, then smaller machines (c2d-112 → c2d-56 → n2d-64 → n2d-32); unlaunched runs stay `pending` |
| a run crashes | only that run stops; `failed` with its log tail; `resume` retries it up to `--maxRetries` |
| VM boot / Node install / git fails | retried 5×, then every run on that VM is reported `failed` with the reason |
| time budget used | `paused` (not failed); `resume` continues it |
| runaway VM | GCE `max-run-duration` = hours + 45 min with auto-delete; VMs delete themselves when done; `stop` deletes all |
| double launch | a sweep id can only be launched once; `resume` skips runs whose VM is still heartbeating |
| engine / code drift | VMs check out the manifest's commit; `train.js` refuses a state from another engine |

Tested locally (`--bucket=<folder>` runs the VM script in-process): normal run, init crash (isolated, capped retries),
a killed runner (→ lost → resumed from checkpoint with a single init), a time-budget pause resumed across 3 attempts
to completion, and the dry-run gcloud commands.

## Helper VMs: one run over many machines (Oct 31)
An expert-iteration run can spread its fights over helper VMs: give the run entry `"helpers": K` (or `launch --helpers=K`).
The leader (WA_DIST = `<bucket>/sweeps/<id>/runs/<run>/dist`) cuts each batch (collect: 24 fights per chunk; evals: 200 jobs)
into chunks in the bucket; helpers (`policy/dist_helper.js`) and the leader claim chunks atomically (`--if-generation-match=0`),
run them and write the results. A claim older than 30 min without a result is retaken (preempted helper), and a resumed
leader reuses the chunks it already wrote. Results are sorted by job, so a split run is byte-identical to a one-VM run
(checked locally: 2 threads vs 1, leader alone, leader + 3 helpers). `gcp.js helpers <ID> --n=K` tops up running runs (e.g.
after a quota increase); resume re-adds them. The CPU quota (CPUS_ALL_REGIONS, 64 today) caps leaders + helpers together.
