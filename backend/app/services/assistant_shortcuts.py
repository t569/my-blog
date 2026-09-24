"""Answers the assistant gives without calling a model.

Every reply here costs zero tokens. Three kinds:

- **Author-only questions** — hiring, rates, availability, contact, meeting,
  personal details. A model can only guess at these, and a wrong guess about
  someone's rates or availability is worse than none. They get the author's
  contact line instead.
- **Small talk** — greetings, thanks, "who are you". Canned, in character.
- **Repeats** — a first-turn question someone has already asked gets the stored
  answer. Popular questions cost tokens once.

The matching is deliberately conservative: an ambiguous word ("cost",
"available", "job") only counts when it is aimed at a person ("your rates",
"is he available"), because this blog *writes about* costs and job schedulers
and those questions deserve a real answer. A miss here just costs a model call;
a false hit refuses a fair question.
"""

import re
import time
from collections import OrderedDict

from app.config import settings

def _person() -> str:
    """Words aimed at a person rather than a topic, plus the author's own names.

    Names come from ASSISTANT_AUTHOR_NAMES, never from code: this module is
    shared, and a name baked in here would be one fork's name in everyone's.
    """
    names = [re.escape(normalize(n)) for n in settings.ASSISTANT_AUTHOR_NAMES.split(",") if n.strip()]
    words = ["you", "your", "yours", "him", "his", "he", "her", "she", "author", "owner", "writer", *names]
    return "(" + "|".join(words) + ")"


def _author_only_patterns() -> list[re.Pattern[str]]:
    p = _person()
    return [
        # Unambiguous on their own. (Input is normalized: "e-mail" arrives as "e mail".)
        re.compile(r"\b(hire|hiring|freelanc\w*|recruit\w*|headhunt\w*)\b"),
        re.compile(r"\b(contact|reach out|get in touch|email|e mail|phone number|whatsapp)\b"),
        re.compile(r"\b(collaborat\w*|partnership|sponsor\w*|podcast guest|speak at)\b"),
        re.compile(r"\b(resume|cv|portfolio review|consult\w*)\b"),
        # Ambiguous words, only when aimed at a person.
        re.compile(rf"\b(rates?|pricing|price|quote|charge|salary|cost)\b.*\b{p}\b"),
        re.compile(rf"\b{p}\b.*\b(rates?|pricing|charge|salary)\b"),
        re.compile(rf"\b(available|availability|free for|open to)\b.*\b{p}\b"),
        re.compile(rf"\b(is|are) {p}\b.*\b(available|free|open to work|looking)\b"),
        re.compile(rf"\b(meet|meeting|interview|coffee)\b.*\b{p}\b"),
        re.compile(rf"\b(where does|where do|how old|is) {p}\b.*\b(live|from|old|married|single)\b"),
    ]

_SMALL_TALK: dict[str, str] = {}


def _small_talk_table() -> dict[str, str]:
    """Built lazily so it picks up the configured name."""
    if _SMALL_TALK:
        return _SMALL_TALK
    name = settings.ASSISTANT_NAME
    hello = f"Hello! I'm {name}. Ask me about anything on this blog — a post, a topic, where to start."
    thanks = "Any time. If something else comes up, I'm here."
    who = (
        f"I'm {name}, this blog's guide. I know what's been written here and can point you to "
        "the right post. For anything about the author personally, I'll hand you their contact details."
    )
    for k in ("hi", "hello", "hey", "hiya", "yo", "howdy", "good morning", "good afternoon", "good evening", "hi there", "hello there", "hey there"):
        _SMALL_TALK[k] = hello
    for k in ("thanks", "thank you", "thx", "ty", "cheers", "thanks a lot", "thank you so much", "great thanks", "ok thanks"):
        _SMALL_TALK[k] = thanks
    for k in ("bye", "goodbye", "see you", "see ya", "later"):
        _SMALL_TALK[k] = "Safe travels. The posts will be here when you're back."
    for k in ("who are you", "what are you", "what can you do", "help", "what do you do"):
        _SMALL_TALK[k] = who
    return _SMALL_TALK


def normalize(message: str) -> str:
    """Lowercase, letters/digits/spaces only, single-spaced — the cache and lookup key."""
    text = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    return re.sub(r"\s+", " ", text).strip()


def contact_reply() -> str:
    contact = settings.ASSISTANT_CONTACT.strip()
    if contact:
        return f"That one's for the author to answer, not me. {contact}"
    return "That one's for the author to answer, not me — the contact links in the footer will reach them."


def is_author_only(message: str) -> bool:
    text = normalize(message)
    return any(p.search(text) for p in _author_only_patterns())


class AnswerCache:
    """First-turn answers by normalized question. FIFO-evicted, time-limited.

    # ponytail: in-process, like the rate limiter — one Render instance. Move
    # to Redis if the backend ever runs more than one worker.
    """

    def __init__(self, max_entries: int = 500, ttl_seconds: int = 86400) -> None:
        self.max_entries = max_entries
        self.ttl = ttl_seconds
        self._items: OrderedDict[str, tuple[float, str]] = OrderedDict()

    def get(self, key: str) -> str | None:
        hit = self._items.get(key)
        if not hit:
            return None
        stamp, answer = hit
        if time.time() - stamp > self.ttl:
            del self._items[key]
            return None
        return answer

    def put(self, key: str, answer: str) -> None:
        if not key or not answer.strip():
            return
        self._items[key] = (time.time(), answer)
        self._items.move_to_end(key)
        while len(self._items) > self.max_entries:
            self._items.popitem(last=False)


answer_cache = AnswerCache()


def answer_without_model(message: str, has_history: bool) -> tuple[str, str] | None:
    """A free answer, as ``(kind, text)``, or ``None`` when a model is needed.

    ``kind`` is ``author``, ``smalltalk`` or ``cached`` — logged, and handy in
    tests. Small talk and the cache only apply to an opening message: mid
    conversation, "thanks" or a repeated question may depend on what came before.
    """
    if is_author_only(message):
        return ("author", contact_reply())
    if has_history:
        return None
    key = normalize(message)
    canned = _small_talk_table().get(key)
    if canned:
        return ("smalltalk", canned)
    cached = answer_cache.get(key)
    if cached:
        return ("cached", cached)
    return None
