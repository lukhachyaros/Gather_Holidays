


# 🎉 Gather Holidays 3D

Một không gian 3D tương tác nhiều người chơi chạy hoàn toàn trên trình duyệt để mọi người cùng đón lễ hội: đi dạo, ngắm cảnh, tương tác, viết thiệp, trang trí map theo chủ đề và xem YouTube chung. **Không cần server backend, không cần build** — chạy bằng HTML, WebGL (three.js) và P2P WebRTC.

## Tính năng
- 🎮 **2 góc nhìn:**
  - **Góc nhìn thứ ba (TPS):** Camera bám sau lưng nhân vật, tự né tường/vật cản.
  - **Góc nhìn thứ nhất (FPS):** Nhìn qua mắt nhân vật, tâm ngắm giữa màn hình.
  - Phím **V** để chuyển nhanh giữa 2 góc nhìn. Phím **L** để khoá/mở chuột (Pointer Lock).
- 🚶 **Di chuyển & Cử động 3D:**
  - `WASD` / mũi tên để di chuyển, giữ `Shift` để chạy nhanh, `Space` để nhảy.
  - Model 3D nhân vật đầy đủ bộ khung xương và animation (Idle, Walk, Run, Jump).
  - Tự đổi màu nhân vật theo avatar bạn chọn để dễ phân biệt.
- 🤝 **Tương tác trực tiếp:**
  - Nhắm vào người chơi khác rồi click chuột hoặc bấm phím **E** khi đứng gần để mở menu tương tác:
  - Vẫy tay (Wave)
  - Nhảy múa ăn mừng (Dance)
  - Đập tay (Thumbs up)
  - Tặng quà (Yes/gift), Gửi thiệp riêng.
  - Phím tắt nhanh `1` - `4` để phát emote chuyển động tức thì.
  - Chat bong bóng thoại nổi trên đầu nhân vật và thanh chat góc dưới.
- 💌 **Viết thiệp lễ hội:**
  - Gửi riêng cho bạn bè trong phòng hoặc **ghim trực tiếp lên map 3D** thành hình phong thư 💌 bay bổng. Người khác có thể lại gần bấm xem và lưu vào hộp thư cá nhân (`localStorage`).
- 🎨 **Trang trí 3D theo từng mùa lễ:**
  - 6 chủ đề: 🎃 Halloween, 🎄 Giáng sinh, 🧧 Tết Nguyên Đán, 🥮 Trung thu, 🎆 Năm mới, 💝 Valentine.
  - Map Valentine có Cây Trái Tim, đài phun nước ước nguyện, cổng hoa hồng, ghế đôi và điểm viết thiệp tình yêu.
  - Hiệu ứng hạt bay 3D đặc trưng: tuyết rơi, hoa mai, cánh hoa hồng, trái tim và dơi đêm...
- 🎙️ **Voice Chat P2P & Âm thanh không gian 3D (Spatial Audio):**
  - Đàm thoại trực tiếp thời gian thực P2P WebRTC không cần server trung gian.
  - Tự động điều chỉnh âm lượng theo khoảng cách 3D (đứng gần nghe to rõ, đi xa âm lượng giảm dần tự nhiên).
  - Đèn báo nói (VAD): Avatar 3D tự động hiển thị biểu tượng `🎙️` sóng âm màu xanh ngọc bích phát sáng trên đầu khi bạn hoặc bạn bè đang nói chuyện.
  - Phím tắt nhanh **M** để Bật / Tắt Microphone tức thì.
- 🖥️ **Chia sẻ màn hình trực tiếp lên TV 3D khổng lồ (Screen Share):**
  - Chiếu toàn bộ màn hình máy tính, cửa sổ ứng dụng (PowerPoint, Code, Discord, Game...) hoặc tab trình duyệt kèm âm thanh lên chiếc TV lớn giữa map.
  - Mọi người trong phòng cùng xem chung thời gian thực với độ trễ siêu thấp.
  - Bảng LED trên nóc TV và màn hình cập nhật người đang chia sẻ.
  - Chế độ **Rạp chiếu TV / Phóng to toàn màn hình** (Cinema Theater Mode) giúp xem chi tiết từng nét văn bản, slide bài giảng hoặc phim HD sắc nét.
  - Phím tắt nhanh **P** để bắt đầu / dừng chia sẻ màn hình ngay lập tức.
- 🎵 **Rạp chiếu YouTube & Trình duyệt Web TV đồng bộ:**
  - Dán link video/nhạc YouTube hoặc website bất kỳ, cả phòng sẽ cùng xem và nghe đồng thời theo thời gian thực. Màn hình ảo hiển thị trên map 3D kèm khung video trực quan.

## Cách chạy
Mở thư mục bằng bất kỳ static web server nào (do các ES module và file `.glb` cần HTTP/HTTPS, không chạy trực tiếp bằng protocol `file://`):
```bash
python3 -m http.server 8080   # rồi mở http://localhost:8080 trên trình duyệt
```

### Triển khai lên GitHub Pages
Dự án đã tích hợp sẵn GitHub Actions workflow `.github/workflows/pages.yml`.
1. Vào repo trên GitHub: **Settings** -> **Pages**.
2. Tại mục **Build and deployment > Source**, chọn **GitHub Actions**.
3. Mỗi khi push lên nhánh `main`, website sẽ tự động deploy lên địa chỉ `https://<username>.github.io/Gather_Holidays/`.
4. Chia sẻ link kèm mã phòng: `https://<username>.github.io/Gather_Holidays/#room=phong-cua-ban`.

## Phím tắt điều khiển
| Phím | Hành động |
|---|---|
| `W, A, S, D` / `Mũi tên` | Di chuyển |
| `Shift` (giữ) | Chạy nhanh |
| `Space` | Nhảy |
| `Kéo chuột` | Xoay góc nhìn camera |
| `V` | Đổi góc nhìn: Góc nhìn thứ 3 (TPS) ↔ Góc nhìn thứ nhất (FPS) |
| `L` | Khoá / mở con trỏ chuột (Pointer Lock kiểu FPS) |
| `M` | Bật / Tắt Microphone Voice Chat (Có sóng âm 🎙️ trên đầu) |
| `P` | Bật / Dừng Chia sẻ màn hình máy tính lên TV lớn |
| `E` | Tương tác nhanh với người đứng gần hoặc phong thư ghim gần đó |
| `1, 2, 3, 4` | Bật hoạt ảnh emote (Vẫy tay, Thumbs up, Nhảy múa, Đồng ý) |
| `Enter` | Nhập nội dung chat |
| `Esc` | Thoát chế độ vẽ map hoặc thoát khoá chuột |

## Cấu trúc mã nguồn
```
Gather_Holidays/
├── index.html               # Trang chính chứa UI overlay và importmap Three.js
├── css/style.css            # Giao diện HUD, cửa sổ chat, bảng chọn lễ hội, tâm ngắm, rạp chiếu
├── js/
│   ├── game.js              # Logic vòng lặp chính, điều khiển camera FPS/TPS, input, đồng bộ
│   ├── rtc.js               # Động cơ WebRTC P2P Voice Chat, 3D Spatial Audio & Screen Sharing
│   ├── world.js             # Dựng không gian 3D, instanced mesh (sàn, tường, nước), ánh sáng, hạt rơi
│   ├── avatar.js            # Nạp model GLB, skeleton clone, animation mixer, VAD soundwave badge
│   ├── props.js             # Khởi tạo mô hình 3D đồ trang trí procedural & màn hình TV lớn
│   ├── maps.js              # Cấu trúc dữ liệu map, kiểm tra tính hợp lệ của tile
│   ├── themes.js            # Định nghĩa các chủ đề lễ hội, màu sắc, danh sách đồ trang trí
│   ├── media.js             # Tích hợp YouTube IFrame, Trình duyệt Web TV và Live Screen Share
│   └── net.js               # Hệ thống Bus MQTT WSS & BroadcastChannel đồng bộ P2P không cần backend
├── assets/
│   └── models/
│       └── RobotExpressive.glb # Model nhân vật 3D CC0 kèm 14 hoạt ảnh
├── vendor/three/            # Bản phân phối Three.js r170 (chạy offline / local không phụ thuộc CDN bên ngoài)
├── maps/                    # Thư mục chứa các bản đồ JSON mẫu
├── CREDITS.md               # Thông tin bản quyền các tài nguyên 3D
└── README.md
```

## Giấy phép & Tác quyền
- Mã nguồn dự án: MIT.
- Tài nguyên 3D và thư viện: xem chi tiết tại [CREDITS.md](CREDITS.md).
