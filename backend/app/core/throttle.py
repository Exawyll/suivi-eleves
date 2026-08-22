import time
from dataclasses import dataclass, field

from app.core.exceptions import TooManyAttemptsError

MAX_FAILURES = 10
WINDOW_SECONDS = 15 * 60


@dataclass
class _Attempts:
    count: int = 0
    first_failure_at: float = 0.0


@dataclass
class AttemptThrottle:
    """Locks a key out after repeated failures, for a fixed window.

    In-process and therefore per-replica: this service runs as a single
    container, so it is a real limit today, but it would need a shared store
    (Redis, or a table) the day the deployment scales out. It is a speed bump
    against online guessing, not a defence against a distributed attack.

    A lockout rather than a growing delay on purpose: sleeping inside the
    request would hold a worker slot open, which is exactly what an attacker
    would want.
    """

    max_failures: int = MAX_FAILURES
    window_seconds: int = WINDOW_SECONDS
    _failures: dict[str, _Attempts] = field(default_factory=dict)

    def check(self, key: str) -> None:
        """Raises when `key` is locked out. Call before doing any real work."""
        attempts = self._failures.get(key)
        if attempts is None:
            return
        if time.monotonic() - attempts.first_failure_at >= self.window_seconds:
            del self._failures[key]
            return
        if attempts.count >= self.max_failures:
            raise TooManyAttemptsError

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        attempts = self._failures.get(key)
        if attempts is None or now - attempts.first_failure_at >= self.window_seconds:
            self._failures[key] = _Attempts(count=1, first_failure_at=now)
            return
        attempts.count += 1

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def clear(self) -> None:
        self._failures.clear()


login_throttle = AttemptThrottle()
