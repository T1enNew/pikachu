# Nối Thú Sấm Sét

Game nối thú theo lối Pikachu cổ điển, chạy thẳng trên trình duyệt: không cần cài đặt, không cần build.

## Chơi thế nào

Repo được Vercel deploy tự động mỗi khi push lên `main`, nên mở link Vercel của dự án trên máy tính hoặc điện thoại là chơi được ngay. Khi chơi trên máy, mở thẳng `index.html` bằng Chrome, Edge hoặc Firefox là được. Đây là trang tĩnh, không cần build.

**Trên điện thoại:**
- Cả game nằm gọn trong một màn hình, không phải cuộn. Thanh vật phẩm nằm ở cạnh dưới cho dễ bấm bằng ngón cái.
- Bàn cờ tự xoay theo chiều máy, kể cả khi đang chơi mà bạn xoay ngang hoặc dọc.
- Quân được chọn ngay khi ngón tay chạm vào. Máy rung nhẹ khi nối được (trên Android), và tắt âm thanh thì rung cũng tắt theo.
- Các hộp thoại mở dạng ngăn kéo từ dưới lên. Nút rương ở góc trên mở bảng mốc thưởng.
- Có thể chọn "Thêm vào màn hình chính" để chơi toàn màn hình như một ứng dụng.

**Luật chơi:**

- Chọn 2 quân giống nhau. Hai quân nối được khi đường giữa chúng rẽ **tối đa 2 lần** và không cắt qua quân khác. Đường được phép vòng ra ngoài mép bàn.
- Xoá sạch bàn trước khi hết giờ. Nối liên tiếp trong 3,5 giây sẽ ăn **combo** cộng điểm.
- Khi không còn nước đi, bàn tự xáo lại miễn phí.

## Độ khó tăng sau mỗi lần thắng

| Màn | Bàn | Số loài | Giây / cặp | Quân tự dồn |
|---|---|---|---|---|
| 1 | 5×8 | 11 | 6.0 | Đứng yên |
| 3 | 6×10 | 15 | 5.3 | Dồn xuống |
| 5 | 7×12 | 19 | 4.6 | Dồn lên |
| 7 | 8×14 | 23 | 3.9 | Ép vào giữa |
| 10+ | 10×16 | 29 → 40 | 3.0 | Luân phiên 8 kiểu |

## Vật phẩm, hộp quà và mốc thưởng

Mỗi vật phẩm (và cả mạng) giữ **tối đa 3 lượt**. Quà nhận được khi kho đã đầy sẽ đổi thành 150 điểm.

| Vật phẩm | Phím | Tác dụng |
|---|---|---|
| Gợi ý | `H` | Sáng lên một cặp nối được |
| Xáo trộn | `S` | Xếp lại vị trí mọi quân |
| Thêm giờ | `T` | Cộng 20 giây, cũng dùng được để cứu màn khi vừa hết giờ |
| Sét đánh | `B` | Tự xoá ngay một cặp |

- **Hộp quà:** mỗi lần thắng được chọn 1 trong 3 hộp, mỗi hộp chứa vật phẩm, mạng hoặc điểm ngẫu nhiên.
- **Mốc thưởng:** qua màn 2, 3, 5, 7, 10, 13, 16, 20 (và mỗi 5 màn sau đó) nhận thêm quà cố định. Màn 20 là Rương kim cương làm đầy mọi kho.
- **Điểm qua màn:** điểm nối + 5 điểm cho mỗi giây còn lại + 100 × số màn. Còn trên 50% thời gian được 3 sao.

Phím khác: `P` / `Esc` tạm dừng, `M` bật/tắt âm thanh. Tiến trình và kỷ lục được lưu trong trình duyệt.

## Cấu trúc

```
index.html            khung trang
style.css             giao diện máy tính, điện thoại dọc và điện thoại ngang
manifest.webmanifest  cài lên màn hình chính như ứng dụng
icons/                biểu tượng ứng dụng
js/logic.js           sinh bàn, tìm đường ≤ 2 lần rẽ, dồn quân, xáo trộn, cấu hình độ khó
js/rewards.js         vật phẩm, mốc thưởng, hộp quà, âm thanh
js/ui.js              vẽ HUD, khay vật phẩm, thanh mốc thưởng, hộp thoại
js/game.js            trạng thái, chọn và nối quân, đồng hồ, dùng vật phẩm
js/flow.js            màn bắt đầu, thắng, hết giờ, thua, lưu tiến trình
```
