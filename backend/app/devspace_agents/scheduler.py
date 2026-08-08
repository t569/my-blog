"""Agent scheduler — APScheduler wiring for cron-based pipeline triggers."""

import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.devspace_agents.pipeline.runner import run_agent_pipeline

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def start_scheduler(owner_id: uuid.UUID, cron_expr: str) -> None:
    # Single gate for every scheduled entry point — startup and reschedule().
    # Credentials say whether it can run; the owner's switch says whether it
    # should. Imported here, not at module scope: feature_service imports the
    # session factory, and this module is imported during app startup.
    from app.services import feature_service

    if not await feature_service.enabled("agent"):
        logger.info(
            "Agent pipeline disabled (AGENT_ENABLED=%s, GROQ_API_KEY %s, "
            "owner switch may be off) — not scheduling.",
            settings.AGENT_ENABLED,
            "set" if settings.GROQ_API_KEY else "unset",
        )
        return

    if not scheduler.running:
        scheduler.start()

    trigger = CronTrigger.from_crontab(cron_expr)
    scheduler.add_job(
        run_agent_pipeline,
        trigger=trigger,
        id=f"agent_pipeline_{owner_id}",
        replace_existing=True,
        kwargs={"owner_id": owner_id, "triggered_by": "schedule"},
    )
    logger.info("Scheduled agent pipeline for owner %s: %s", owner_id, cron_expr)


async def reschedule(owner_id: uuid.UUID, cron_expr: str, is_active: bool) -> None:
    if not is_active:
        job_id = f"agent_pipeline_{owner_id}"
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
            logger.info("Removed scheduled job for owner %s", owner_id)
        return

    await start_scheduler(owner_id, cron_expr)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down.")
