"""Self-check: a post's cover is its first https image, and only that.

Run:  python -m scripts.check_cover   (from backend/)
"""

import os
import sys

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

from app.models.post import Post  # noqa: E402

cases = [
    ("Intro\n\n![a cat](https://res.cloudinary.com/x/cat.png) and more", "https://res.cloudinary.com/x/cat.png"),
    ('<p>hi</p><img class="w" src="https://img.example/one.jpg"> ![b](https://img.example/two.jpg)', "https://img.example/one.jpg"),
    ("![insecure](http://img.example/a.png)", None),  # rendered on public pages: https only
    ("![js](javascript:alert(1))", None),
    ("No pictures at all.", None),
    ("", None),
]

failed = 0
for content, expected in cases:
    got = Post(content=content).cover_image
    ok = got == expected
    failed += not ok
    print(f"{'ok  ' if ok else 'FAIL'}  {content[:48]!r} -> {got}")

print()
if failed:
    print(f"{failed} cover check(s) failed")
    sys.exit(1)
print("all cover checks passed.")
