# VietOCR sidecar (offline) — TrishWork

OCR tiếng Việt (kể cả chữ viết tay) cho panel **Khảo sát (OCR)** trong nhóm
Khảo sát · Thiết kế. Chạy hoàn toàn offline bằng một tiến trình Python đóng gói
thành `.exe`, do app Tauri tự khởi động khi cần.

```
ảnh sổ khảo sát → [cắt dòng OpenCV] → [VietOCR nhận dạng từng dòng] → text → AI chuẩn hoá
```

## Vì sao có thư mục này
VietOCR là thư viện Python/PyTorch và là bộ nhận dạng **theo dòng**, không thể
gọi thẳng từ Rust/JS. Nên ta đóng gói nó thành 1 service `.exe` riêng và app gọi
qua HTTP localhost.

---

## A. Phát triển / test nhanh (chưa cần build .exe)

Trên máy Windows có Python 3.10 hoặc 3.11:

```powershell
cd apps-desktop\trishwork\sidecar-vietocr
python -m venv .venv-sidecar
.\.venv-sidecar\Scripts\Activate.ps1
pip install -r requirements.txt

# Chạy thử service (lần đầu tự tải weights pretrained ~ vài chục MB):
python ocr_service.py --port 39127
# Đợi in: VIETOCR_READY 39127
```

Mở terminal khác test:
```powershell
# health
curl http://127.0.0.1:39127/health
# OCR 1 ảnh
curl -X POST http://127.0.0.1:39127/ocr -H "Content-Type: application/json" `
  -d "{\"image_path\":\"C:\\\\duong_dan\\\\anh.jpg\"}"
```

## B. Build thành .exe đóng gói vào app

```powershell
cd apps-desktop\trishwork\sidecar-vietocr
powershell -ExecutionPolicy Bypass -File .\build-sidecar.ps1
```
→ tạo `dist\vietocr-sidecar.exe`.

### Đóng gói vào app (offline)
1. Tạo thư mục `apps-desktop\trishwork\src-tauri\resources\vietocr\`.
2. Copy vào đó:
   - `vietocr-sidecar.exe` (từ `dist\`)
   - file weights `.pth` đã tải (đường dẫn được in ra khi chạy build script,
     thường ở `C:\Users\<user>\.cache\...` hoặc cạnh config). Đổi tên rõ ràng
     ví dụ `vgg_transformer.pth`.
3. Mở `src-tauri\tauri.conf.json`, trong `bundle` thêm:
   ```json
   "resources": {
     "resources/vietocr/*": "vietocr/"
   }
   ```
   (gộp với mục resources sẵn có nếu đã có.)
4. Rust command sẽ tự tìm `resources/vietocr/vietocr-sidecar.exe` và chạy với
   `--weights resources/vietocr/vgg_transformer.pth`. Xem `src-tauri/src/vietocr.rs`.

> ⚠ KHÔNG thêm mục `resources` ở bước 3 cho tới khi file `.exe` thực sự tồn tại,
> nếu không `tauri build`/`tauri dev` sẽ báo thiếu resource.

---

## C. Nâng độ chính xác cho chữ viết tay (fine-tune)

Pretrained VietOCR đọc chữ in tốt, viết tay khá nhưng chưa tối ưu cho nét chữ sổ
khảo sát. Để nâng cấp, fine-tune trên dataset:
`5CD-AI/Viet-Handwriting-OCR-v2` (Hugging Face, cần đăng nhập + chấp nhận điều khoản).

Tóm tắt quy trình fine-tune (làm 1 lần, trên máy có GPU càng tốt):
1. Tải dataset (ảnh dòng + nhãn text) → đưa về định dạng VietOCR yêu cầu
   (mỗi dòng `tên_ảnh\tnhãn` trong file `train_annotation.txt`).
2. Dùng `vietocr` trainer với config `vgg_transformer`, nạp pretrained làm
   khởi điểm, train thêm vài epoch.
3. Lấy file `.pth` kết quả → thay cho weights ở bước B.2.

Chi tiết trainer: xem repo `pbcquoc/vietocr` (mục Training).

---

## D. Nâng cấp bộ cắt dòng (detector)
Mặc định cắt dòng bằng projection profile (OpenCV) — nhẹ, hợp sổ kẻ dòng. Với
layout phức tạp/nghiêng, thay `detect_lines()` trong `ocr_service.py` bằng
PaddleOCR DB detector (bỏ comment paddle trong `requirements.txt`).
