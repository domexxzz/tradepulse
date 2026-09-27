"""
QVX AI gateway - ตัวกลางระหว่างเว็บ (Vercel) กับ Ollama บนเครื่องบ้าน (คอมเบส)

ทำไมต้องมี:
  - Ollama ไม่มีระบบยืนยันตัวตน เปิดออกเน็ตตรง ๆ ใครก็ใช้การ์ดจอเราได้
  - Ollama ผ่าน API แบบ OpenAI ตั้ง num_ctx ไม่ได้ ค่าเริ่มต้น 4096 จะตัดคำสั่งส่วนต้นทิ้งเงียบ ๆ
    (รวมถึงกฎ "ห้ามแต่งราคา") - ที่นี่แปลงไปใช้ API ของ Ollama เองซึ่งตั้งได้
  - การ์ดจอตอบได้ทีละคำขอ ถ้าคิวยาวให้ตอบ "busy" ทันที เว็บจะสลับไปตัวสำรองบนคลาวด์
    ดีกว่าให้ลูกค้ารอจนหมดเวลา

พูดภาษาเดียวกับ OpenAI Chat Completions (stream แบบ SSE) เว็บเลยใช้ตัวเรียกตัวเดียว
ได้ทั้งเครื่องบ้านและคลาวด์

ใช้ Python มาตรฐานล้วน ไม่ต้อง pip install อะไร - เครื่องบ้านมีหลายโปรเจกต์ ลด dependency ให้มากที่สุด

รัน:  python qvx_ai_gateway.py --secret-env "C:\\path\\to\\bot\\.env"
      (อ่าน TV_BOT_SECRET จากไฟล์นั้น - ค่าเดียวกับที่เว็บใช้คุยกับบอท TradingView)
"""
from __future__ import annotations

import argparse
import hmac
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 512 * 1024


def log(msg: str) -> None:
    # print เป็น ASCII/UTF-8 ผ่าน stdout ที่ keeper เก็บลงไฟล์ - ไม่ใส่ค่าลับลง log เด็ดขาด
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    try:
        print(line, flush=True)
    except Exception:
        pass


def read_secret(path: str) -> str:
    """อ่าน TV_BOT_SECRET จาก .env ของบอท (บางเครื่องเซฟเป็น UTF-8 มี BOM)"""
    with open(path, "r", encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.strip()
            if line.startswith("TV_BOT_SECRET"):
                _, _, value = line.partition("=")
                return value.strip().strip('"').strip("'")
    return ""


class Config:
    def __init__(self, args: argparse.Namespace) -> None:
        self.ollama = args.ollama.rstrip("/")
        self.model = args.model
        self.num_ctx = args.num_ctx
        self.temperature = args.temperature
        self.max_tokens = args.max_tokens
        self.keep_alive = args.keep_alive
        self.queue_timeout = args.queue_timeout
        self.secret = args.secret or (read_secret(args.secret_env) if args.secret_env else "")
        self.slots = threading.BoundedSemaphore(args.max_concurrent)
        self.busy = 0
        self.busy_lock = threading.Lock()
        self.health_cache: tuple[float, dict] = (0.0, {})


CFG: Config


def ollama_health() -> dict:
    """ถาม Ollama ว่ามีชีวิตและมีโมเดลที่ใช้ไหม - เก็บผลไว้ 20 วินาที กันยิงถี่"""
    now = time.time()
    ts, cached = CFG.health_cache
    if cached and now - ts < 20:
        return cached
    result = {"ollama": False, "model_present": False}
    try:
        with urllib.request.urlopen(f"{CFG.ollama}/api/tags", timeout=5) as r:
            tags = json.loads(r.read().decode("utf-8"))
        names = {m.get("name", "") for m in tags.get("models", [])}
        result = {"ollama": True, "model_present": CFG.model in names}
    except Exception as e:  # noqa: BLE001
        result["error"] = type(e).__name__
    CFG.health_cache = (now, result)
    return result


def sse(obj: dict | str) -> bytes:
    data = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return f"data: {data}\n\n".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "QVXGateway/1"

    # http.server พิมพ์ทุกคำขอลง stderr - ปิดไว้ ใช้ log() ของเราแทน
    def log_message(self, *_args) -> None:  # noqa: D401
        return

    # ---------- helpers ----------
    def _json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _chunk(self, data: bytes) -> None:
        if not data:
            return
        self.wfile.write(f"{len(data):X}\r\n".encode("ascii") + data + b"\r\n")
        self.wfile.flush()

    def _end_chunks(self) -> None:
        self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def _authorized(self) -> bool:
        if not CFG.secret:
            return False
        header = self.headers.get("Authorization", "")
        given = header[7:] if header.startswith("Bearer ") else ""
        return hmac.compare_digest(given.encode("utf-8"), CFG.secret.encode("utf-8"))

    # ---------- routes ----------
    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?")[0] == "/health":
            h = ollama_health()
            ok = bool(h.get("ollama") and h.get("model_present"))
            self._json(200 if ok else 503, {"ok": ok, "model": CFG.model, "busy": CFG.busy, **h})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?")[0] != "/v1/chat/completions":
            self._json(404, {"error": "not_found"})
            return
        if not self._authorized():
            self._json(401, {"error": "unauthorized"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._json(413 if length > MAX_BODY else 400, {"error": "invalid_body_size"})
            return
        try:
            req = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:  # noqa: BLE001
            self._json(400, {"error": "invalid_json"})
            return

        messages = req.get("messages")
        if not isinstance(messages, list) or not messages:
            self._json(400, {"error": "invalid_messages"})
            return
        clean = []
        for m in messages:
            role, content = (m or {}).get("role"), (m or {}).get("content")
            if role not in ("system", "user", "assistant") or not isinstance(content, str):
                self._json(400, {"error": "invalid_messages"})
                return
            clean.append({"role": role, "content": content})

        stream = bool(req.get("stream"))
        max_tokens = min(int(req.get("max_tokens") or CFG.max_tokens), CFG.max_tokens)

        # การ์ดจอว่างไหม - รอได้ไม่เกิน queue_timeout แล้วตอบ busy ให้เว็บสลับไปตัวสำรอง
        if not CFG.slots.acquire(timeout=CFG.queue_timeout):
            log("busy -> 503")
            self._json(503, {"error": "busy"})
            return
        with CFG.busy_lock:
            CFG.busy += 1
        started = time.time()
        try:
            self._proxy(clean, stream, max_tokens)
            log(f"ok {time.time() - started:.1f}s stream={stream} msgs={len(clean)}")
        except (BrokenPipeError, ConnectionResetError):
            log("client disconnected")
        except Exception as e:  # noqa: BLE001
            log(f"error {type(e).__name__}: {e}")
        finally:
            with CFG.busy_lock:
                CFG.busy -= 1
            CFG.slots.release()

    def _proxy(self, messages: list, stream: bool, max_tokens: int) -> None:
        payload = {
            "model": CFG.model,
            "messages": messages,
            "stream": True,
            # คือเหตุผลหลักที่ต้องมี gateway - ตั้ง context ให้พอกับคำสั่ง + RAG + ข้อมูลกราฟ + ประวัติแชต
            "options": {"num_ctx": CFG.num_ctx, "temperature": CFG.temperature, "num_predict": max_tokens},
            "keep_alive": CFG.keep_alive,
        }
        request = urllib.request.Request(
            f"{CFG.ollama}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            upstream = urllib.request.urlopen(request, timeout=120)
        except urllib.error.HTTPError as e:
            self._json(502, {"error": f"ollama_{e.code}"})
            return
        except Exception as e:  # noqa: BLE001
            self._json(503, {"error": "ollama_unreachable", "detail": type(e).__name__})
            return

        cid = f"qvx-{int(time.time() * 1000)}"
        usage = {"prompt_tokens": 0, "completion_tokens": 0}
        parts: list[str] = []

        if stream:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()

        with upstream:
            for raw in upstream:
                line = raw.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line.decode("utf-8"))
                except Exception:  # noqa: BLE001
                    continue
                if obj.get("error"):
                    raise RuntimeError(str(obj["error"])[:200])
                text = (obj.get("message") or {}).get("content") or ""
                if text:
                    parts.append(text)
                    if stream:
                        self._chunk(sse({
                            "id": cid, "object": "chat.completion.chunk", "model": CFG.model,
                            "choices": [{"index": 0, "delta": {"content": text}, "finish_reason": None}],
                        }))
                if obj.get("done"):
                    usage = {
                        "prompt_tokens": int(obj.get("prompt_eval_count") or 0),
                        "completion_tokens": int(obj.get("eval_count") or 0),
                    }
                    break

        if stream:
            self._chunk(sse({
                "id": cid, "object": "chat.completion.chunk", "model": CFG.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                "usage": usage,
            }))
            self._chunk(sse("[DONE]"))
            self._end_chunks()
        else:
            self._json(200, {
                "id": cid, "object": "chat.completion", "model": CFG.model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "".join(parts)}, "finish_reason": "stop"}],
                "usage": usage,
            })


def main() -> None:
    p = argparse.ArgumentParser(description="QVX AI gateway")
    p.add_argument("--port", type=int, default=8790)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--ollama", default="http://127.0.0.1:11434")
    p.add_argument("--model", default="gemma3:12b")
    p.add_argument("--num-ctx", type=int, default=16384)
    p.add_argument("--temperature", type=float, default=0.4)
    p.add_argument("--max-tokens", type=int, default=1200)
    p.add_argument("--keep-alive", default="30m")
    p.add_argument("--max-concurrent", type=int, default=1)
    p.add_argument("--queue-timeout", type=float, default=20.0)
    p.add_argument("--secret-env", default="")
    p.add_argument("--secret", default=os.environ.get("QVX_GATEWAY_SECRET", ""), help=argparse.SUPPRESS)
    args = p.parse_args()

    global CFG
    CFG = Config(args)
    if not CFG.secret:
        log("FATAL: no secret (TV_BOT_SECRET not found) - refusing to start without auth")
        sys.exit(2)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    log(f"gateway listening {args.host}:{args.port} model={CFG.model} num_ctx={CFG.num_ctx}")
    server.serve_forever()


if __name__ == "__main__":
    main()
