# 🎉 Gather Holidays

Một "thế giới" nhỏ chạy hoàn toàn trên trình duyệt để mọi người cùng đón lễ hội: đi dạo, tương tác, viết thiệp, trang trí map theo chủ đề và xem YouTube chung. **Không cần server, không cần build** — chỉ HTML + ES modules.

## Tính năng
- 🚶 Di chuyển bằng WASD/mũi tên hoặc click; nhìn thấy người khác theo thời gian thực
- 🤝 Tương tác: click người khác → vẫy tay, ôm, đập tay, tặng quà; phím `1-4` thả emote; chat bong bóng (Enter)
- 💌 Viết thiệp: gửi riêng cho một người hoặc treo lên map; hộp thư 📬 lưu trong trình duyệt
- 🎨 Trang trí: đặt/xoá đồ trang trí theo theme (🎃 Halloween, 🎄 Giáng sinh, 🧧 Tết, 🥮 Trung thu, 🎆 Năm mới, 💝 Valentine) + hiệu ứng hạt (tuyết, hoa mai, dơi…)
- 🛠️ Admin build map: vẽ tile, đổi theme, đổi kích thước, xuất/nhập `map.json`, giới hạn quyền trang trí/điều khiển media
- 🎵 Nhạc/video YouTube đồng bộ cho cả phòng (dán link, phát/dừng)

## Chạy
Mở `index.html` qua một static server bất kỳ (ES modules không chạy từ `file://`):
```bash
python3 -m http.server 8080   # rồi mở http://localhost:8080
```
Hoặc bật **GitHub Pages** (Settings → Pages → Source: GitHub Actions); workflow `.github/workflows/pages.yml` sẽ tự deploy. Chia sẻ link dạng `.../#room=ten-phong`.

## Kiến trúc
| File | Vai trò |
|---|---|
| `index.html`, `css/style.css` | UI |
| `js/game.js` | Vòng lặp game, render canvas, input, đồng bộ trạng thái, UI |
| `js/net.js` | P2P WebRTC qua [Trystero](https://trystero.dev) (signaling bằng relay Nostr công cộng) |
| `js/maps.js` | Định dạng map, tile, kiểm tra hợp lệ |
| `js/themes.js` | Theme/lễ hội — **thêm lễ hội mới chỉ cần thêm 1 mục ở đây** |
| `js/media.js` | YouTube IFrame player đồng bộ |

Trạng thái phòng (map, decor, thiệp treo, media) được các peer giữ và gửi cho người mới vào; người đầu tiên vào phòng là người tạo phòng.

## Hạn chế cần biết
- **Không có server ⇒ không có lưu trữ vĩnh viễn**: khi mọi người rời phòng, trạng thái mất. Hãy dùng *Xuất map* và commit vào `maps/` để lưu.
- **Admin là mô hình "tin cậy lỏng"**: mật khẩu admin được băm; người biết mật khẩu có quyền admin, nhưng các peer trong phòng có thể thấy khoá admin khi admin thao tác. Không dùng cho nội dung cần bảo mật. Nếu cần chặt chẽ, thêm backend (Cloudflare Workers/Supabase).
- Một số mạng (NAT đối xứng) cần TURN server; cấu hình `turnConfig` trong `js/net.js` nếu bạn bè không kết nối được.
- Phụ thuộc CDN jsDelivr (Trystero 0.26.0) và relay Nostr công cộng.

## Hướng phát triển
Tile/sprite đẹp hơn, nhiều phòng trong một map (portal), voice/video chat (Trystero media streams), lưu map lên Gist/Supabase, di động (joystick ảo).

Giấy phép: xem `LICENSE`.
