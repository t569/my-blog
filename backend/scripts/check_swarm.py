"""Self-check: a pipeline run is reported agent by agent, and replays exactly.

Run:  python -m scripts.check_swarm   (from backend/)

No model, no database. Feeds the tracker the graph's real edges and the order
LangGraph reports finished nodes in, and checks what a watcher would see —
including one that connects late, which is every watcher behind the 60s proxy.
"""

import asyncio
import os
import sys
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

from app.devspace_agents.pipeline import events  # noqa: E402

EDGES = [
    ("__start__", "orchestrator"),
    ("orchestrator", "research"),
    ("orchestrator", "context"),
    ("orchestrator", "tone"),
    ("research", "writer"),
    ("context", "writer"),
    ("tone", "writer"),
    ("writer", "__end__"),
]

failed = 0


def check(ok: bool, label: str) -> None:
    global failed
    if not ok:
        failed += 1
    print(f"{'ok  ' if ok else 'FAIL'}  {label}")


def states(run_id: uuid.UUID) -> dict:
    """What a watcher's useSwarm would hold after the whole log."""
    agents: dict = {}
    run = "idle"
    for e in events._runs[run_id].events:
        if e["node"] is None:
            run = e["actionStatus"]
        else:
            agents[e["node"]] = e["actionStatus"]
    return {"run": run, "agents": agents}


async def main() -> None:
    run_id = uuid.uuid4()
    t = events.Tracker(run_id, EDGES)
    t.start()
    check(states(run_id) == {"run": "running", "agents": {"orchestrator": "processing"}}, "only the orchestrator starts")

    t.finished("orchestrator")
    s = states(run_id)["agents"]
    check(
        s == {"orchestrator": "done", "research": "processing", "context": "processing", "tone": "processing"},
        "its three dependants start together",
    )

    t.finished("tone")
    t.finished("research")
    check("writer" not in states(run_id)["agents"], "the writer waits for every input, not the first")
    t.finished("context")
    check(states(run_id)["agents"]["writer"] == "processing", "…and starts when the last one lands")

    # A watcher arriving now sees everything so far, then the rest live.
    seen: list[dict] = []

    async def watch() -> None:
        async for e in events.follow(run_id, heartbeat=0.05):
            if e:
                seen.append(e)

    watcher = asyncio.create_task(watch())
    await asyncio.sleep(0.02)
    t.finished("writer")
    t.complete()
    await asyncio.wait_for(watcher, 2)
    check(seen == events._runs[run_id].events, "a late watcher gets the full log, then the live tail, then stops")
    check(states(run_id)["run"] == "done", "the run ends done")

    # Failure mid-run: whoever was working is marked failed, not left thinking.
    bad = uuid.uuid4()
    t2 = events.Tracker(bad, EDGES)
    t2.start()
    t2.finished("orchestrator")
    t2.failed()
    s2 = states(bad)
    check(s2["run"] == "failed" and s2["agents"]["research"] == "failed", "a failure stops every running agent")
    check(not events.is_known(uuid.uuid4()), "an unknown run is reported as unknown")


asyncio.run(main())
print()
if failed:
    print(f"{failed} swarm check(s) failed")
    sys.exit(1)
print("all swarm checks passed.")
