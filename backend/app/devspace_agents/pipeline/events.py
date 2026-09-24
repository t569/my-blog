"""Live progress of a pipeline run, one event per agent state change.

What the admin "swarm" view animates: each node of the graph is a character,
and these events say which are asleep (not started), thinking (running), happy
(done) or unhappy (failed). The wire shape is ``@t569/ai-assistant``'s stream
event, so the frontend reads it with ``useSwarm``.

A follower gets the whole log replayed, then new events as they happen. That
makes reconnecting free: the Vercel proxy cuts a response at 60s, runs take
minutes, and a client that reconnects simply rebuilds the same state.

# ponytail: in-process — one Render instance runs both the pipeline and the
# endpoint. A second instance would need these in the database or Redis.
"""

import asyncio
import time
import uuid
from collections.abc import AsyncIterator

TERMINAL = ("done", "failed")
_KEEP_SECONDS = 3600


class _RunLog:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.changed = asyncio.Event()
        self.finished_at: float | None = None


_runs: dict[uuid.UUID, _RunLog] = {}


def _prune() -> None:
    cutoff = time.time() - _KEEP_SECONDS
    for run_id in [r for r, log in _runs.items() if log.finished_at and log.finished_at < cutoff]:
        del _runs[run_id]


def publish(run_id: uuid.UUID, node: str | None, action_status: str) -> None:
    """Record one change. ``node=None`` is the run as a whole."""
    log = _runs.get(run_id)
    if log is None:
        _prune()
        log = _runs[run_id] = _RunLog()
    log.events.append({"threadId": str(run_id), "node": node, "actionStatus": action_status, "state": {}})
    if node is None and action_status in TERMINAL:
        log.finished_at = time.time()
    # Wake every follower, then re-arm for the next change.
    log.changed.set()
    log.changed = asyncio.Event()


def is_known(run_id: uuid.UUID) -> bool:
    return run_id in _runs


async def follow(run_id: uuid.UUID, heartbeat: float = 15.0) -> AsyncIterator[dict | None]:
    """Replay, then tail until the run ends. Yields ``None`` as a keep-alive."""
    log = _runs.get(run_id)
    if log is None:
        return
    sent = 0
    while True:
        while sent < len(log.events):
            yield log.events[sent]
            sent += 1
        if log.finished_at is not None:
            return
        waiter = log.changed
        try:
            await asyncio.wait_for(waiter.wait(), timeout=heartbeat)
        except TimeoutError:
            yield None


class Tracker:
    """Turns "node X finished" into the full picture, using the graph's edges.

    LangGraph's ``updates`` stream reports a node when it *finishes*. A node has
    *started* once every node feeding it has finished — that is the graph's own
    scheduling rule, so the edges are read from the compiled graph rather than
    restated here.
    """

    def __init__(self, run_id: uuid.UUID, edges: list[tuple[str, str]]) -> None:
        self.run_id = run_id
        self.preds: dict[str, set[str]] = {}
        for src, dst in edges:
            self.preds.setdefault(dst, set()).add(src)
            self.preds.setdefault(src, set())
        self.done: set[str] = set()
        self.running: set[str] = set()

    def start(self) -> None:
        publish(self.run_id, None, "running")
        for node, preds in self.preds.items():
            if not preds or preds <= {"__start__"}:
                self._run(node)

    def finished(self, node: str) -> None:
        self.running.discard(node)
        self.done.add(node)
        publish(self.run_id, node, "done")
        for other, preds in self.preds.items():
            if other in self.done or other in self.running or other.startswith("__"):
                continue
            if preds and preds - {"__start__"} <= self.done:
                self._run(other)

    def failed(self) -> None:
        for node in list(self.running):
            publish(self.run_id, node, "failed")
        publish(self.run_id, None, "failed")

    def complete(self) -> None:
        publish(self.run_id, None, "done")

    def _run(self, node: str) -> None:
        if node.startswith("__"):
            return
        self.running.add(node)
        publish(self.run_id, node, "processing")
