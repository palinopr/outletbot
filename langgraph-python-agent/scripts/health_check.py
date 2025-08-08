from __future__ import annotations

import subprocess
import sys
import time
import urllib.request


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.web.webhook:app", "--host", "127.0.0.1", "--port", str(port)])
    ok = False
    try:
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.5) as r:
                    print(r.read().decode())
                    ok = True
                    break
            except Exception:
                time.sleep(0.25)
    finally:
        p.terminate()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

