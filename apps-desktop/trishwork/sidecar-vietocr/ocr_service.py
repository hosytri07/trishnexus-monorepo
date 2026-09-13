#!/usr/bin/env python3
"""
TrishWork — VietOCR sidecar service (offline).

Một tiến trình Python chạy nền, do app Tauri spawn lúc cần. Giao tiếp qua
HTTP localhost (đơn giản, dễ debug). Model VietOCR + bộ dò dòng được nạp 1 lần
lúc khởi động → mỗi lần OCR không phải nạp lại.

Pipeline cho 1 ảnh:
    ảnh → dò/cắt từng DÒNG chữ → VietOCR nhận dạng mỗi dòng → ghép text.

VietOCR là bộ nhận dạng theo DÒNG (input = ảnh 1 dòng đã cắt), nên BẮT BUỘC
phải có bước cắt dòng trước. Phiên bản đầu dùng cắt dòng bằng OpenCV
(projection profile) — nhẹ, không thêm dependency nặng, hợp sổ khảo sát kẻ dòng.
Có thể nâng cấp sang detector học sâu (PaddleOCR DB) sau — xem hàm detect_lines().

Giao thức HTTP:
    GET  /health        → {"status":"ok","ready":true,"engine":"vietocr",...}
    POST /ocr           body JSON: {"image_base64":"data:image/...;base64,..."}
                          hoặc      {"image_path":"C:\\...\\anh.jpg"}
                        → {"ok":true,"text":"...","lines":["...","..."],"count":N}
    POST /shutdown      → tắt service

Tham số dòng lệnh:
    python ocr_service.py --port 39127 [--device cpu|cuda]
                          [--weights <đường_dẫn_weights.pth>]
                          [--config <vgg_transformer|vgg_seq2seq>]

In ra stdout đúng 1 dòng "VIETOCR_READY <port>" khi đã nạp xong model — Rust
đọc dòng này để biết sidecar sẵn sàng.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from PIL import Image

# ---- Lazy-loaded globals (nạp trong load_models) -----------------------------
_predictor = None          # VietOCR Predictor
_model_lock = threading.Lock()
_engine_info = {"engine": "vietocr", "config": "", "device": "cpu"}


# =============================================================================
# 1. NẠP MODEL VietOCR
# =============================================================================
def load_models(args) -> None:
    """Nạp VietOCR predictor 1 lần. In lỗi rõ ràng nếu thiếu weights/dep."""
    global _predictor
    from vietocr.tool.config import Cfg
    from vietocr.tool.predictor import Predictor

    cfg = Cfg.load_config_from_name(args.config)

    if args.weights and os.path.isfile(args.weights):
        # Dùng weights cục bộ (offline / đã fine-tune trên dataset viết tay).
        cfg["weights"] = args.weights
        cfg["pretrain"] = args.weights
    # else: VietOCR sẽ tự tải pretrained lần đầu (cần mạng 1 lần). Khi đóng gói
    # offline, LUÔN truyền --weights tới file .pth đã tải sẵn (xem README).

    cfg["device"] = args.device
    cfg["predictor"]["beamsearch"] = False  # greedy: nhanh, đủ tốt cho khảo sát

    _predictor = Predictor(cfg)
    _engine_info["config"] = args.config
    _engine_info["device"] = args.device


# =============================================================================
# 2. CẮT DÒNG (detection)
# =============================================================================
def detect_lines(img_gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    """
    Cắt ảnh thành các DÒNG chữ bằng projection profile (OpenCV).
    Trả về list bbox (x, y, w, h) sắp theo thứ tự trên→dưới.

    Hợp với sổ khảo sát/biểu mẫu kẻ dòng, chữ tương đối ngang hàng.
    Với layout phức tạp (nhiều cột, nghiêng) nên thay bằng PaddleOCR DB detector
    (đánh dấu TODO bên dưới).
    """
    import cv2

    h, w = img_gray.shape[:2]
    # Nhị phân hoá (chữ đậm trên nền sáng). Otsu + đảo nếu cần.
    _, binimg = cv2.threshold(
        img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    # Co giãn ngang để nối chữ trong cùng dòng thành 1 dải.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 30), 1))
    dilated = cv2.dilate(binimg, kernel, iterations=1)

    # Tổng pixel mực theo từng hàng → tìm dải có chữ.
    row_sum = dilated.sum(axis=1)
    thresh = row_sum.max() * 0.05 if row_sum.max() > 0 else 0

    lines: list[tuple[int, int, int, int]] = []
    in_line = False
    start = 0
    for y in range(h):
        active = row_sum[y] > thresh
        if active and not in_line:
            in_line = True
            start = y
        elif not active and in_line:
            in_line = False
            if y - start >= 8:  # bỏ dải quá mỏng (nhiễu)
                lines.append((0, start, w, y - start))
    if in_line and h - start >= 8:
        lines.append((0, start, w, h - start))

    # Nếu không cắt được dòng nào → coi cả ảnh là 1 dòng.
    if not lines:
        lines = [(0, 0, w, h)]

    # TODO(nâng cấp): thay bằng PaddleOCR DB detector cho layout phức tạp:
    #   from paddleocr import PaddleOCR
    #   det = PaddleOCR(det=True, rec=False, use_angle_cls=False, lang='vi')
    #   boxes = det.ocr(img_bgr, rec=False) → sort theo y → trả bbox.
    return lines


# =============================================================================
# 3. OCR 1 ẢNH
# =============================================================================
def ocr_image(pil_img: Image.Image) -> dict:
    """Chạy full pipeline trên 1 ảnh PIL → dict {text, lines, count}."""
    import cv2

    rgb = pil_img.convert("RGB")
    arr = np.array(rgb)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)

    boxes = detect_lines(gray)
    out_lines: list[str] = []
    with _model_lock:
        for (x, y, w, h) in boxes:
            pad = 4
            y0 = max(0, y - pad)
            y1 = min(arr.shape[0], y + h + pad)
            x0 = max(0, x - pad)
            x1 = min(arr.shape[1], x + w + pad)
            crop = rgb.crop((x0, y0, x1, y1))
            try:
                text = _predictor.predict(crop)
            except Exception as e:  # 1 dòng lỗi không nên làm hỏng cả trang
                text = ""
                print(f"[vietocr] predict error: {e}", file=sys.stderr, flush=True)
            text = (text or "").strip()
            if text:
                out_lines.append(text)

    return {"text": "\n".join(out_lines), "lines": out_lines, "count": len(out_lines)}


# =============================================================================
# 4. HTTP SERVER
# =============================================================================
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # tắt log mặc định (đỡ spam)
        pass

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok", "ready": _predictor is not None, **_engine_info})
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b""

        if self.path == "/shutdown":
            self._send(200, {"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        if self.path != "/ocr":
            self._send(404, {"ok": False, "error": "not found"})
            return

        try:
            req = json.loads(raw.decode("utf-8")) if raw else {}
            pil_img = _decode_image(req)
            result = ocr_image(pil_img)
            self._send(200, {"ok": True, **result})
        except Exception as e:
            self._send(500, {"ok": False, "error": str(e)})


def _decode_image(req: dict) -> Image.Image:
    if req.get("image_path"):
        return Image.open(req["image_path"])
    b64 = req.get("image_base64", "")
    if "," in b64 and b64.strip().lower().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    data = base64.b64decode(b64)
    return Image.open(io.BytesIO(data))


# =============================================================================
# 5. MAIN
# =============================================================================
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=39127)
    ap.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    ap.add_argument("--config", default="vgg_transformer",
                    choices=["vgg_transformer", "vgg_seq2seq"])
    ap.add_argument("--weights", default="")
    args = ap.parse_args()

    try:
        load_models(args)
    except Exception as e:
        print(f"VIETOCR_ERROR {e}", flush=True)
        sys.exit(2)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    # Báo Rust biết đã sẵn sàng (Rust đọc stdout dòng này).
    print(f"VIETOCR_READY {args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
