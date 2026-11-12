<div align="center">

# 🌟 Gather Holidays 3D

<p align="center">
  <img src="assets/banner.jpg" alt="Gather Holidays Banner" width="100%" style="border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
</p>

[![Three.js](https://img.shields.io/badge/Three.js-r170-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Voice_%26_Screen-333333?style=for-the-badge&logo=webrtc)](https://webrtc.org/)
[![MQTT](https://img.shields.io/badge/MQTT-WSS_Broker-660066?style=for-the-badge&logo=mqtt)](https://mqtt.org/)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-222222?style=for-the-badge&logo=githubpages)](https://lukhachyaros.github.io/Gather_Holidays/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**Không gian lễ hội 3D trực tuyến đa người chơi chạy 100% trên trình duyệt.**  
*Giao lưu, đi dạo, Voice Chat không gian 3D, chiếu màn hình máy tính & YouTube lên TV lớn, chơi Minigame PvP, giải mã câu đố tìm Mật Thất Casino Hoàng Gia và viết thiệp chúc mừng cùng bạn bè mà không cần cài đặt hay server backend phức tạp.*

[🎮 **Chơi Ngay Trên Web**](https://lukhachyaros.github.io/Gather_Holidays/) • [📖 **Hướng Dẫn Chạy Local**](#-hướng-dẫn-chạy-cục-bộ) • [⌨️ **Bảng Phím Tắt**](#️-bảng-phím-tắt-điều-khiển)

</div>

---

## ✨ Điểm Nổi Bật & Tính Năng Mới

<table>
  <tr>
    <td width="50%">
      <h3>🎨 Avatar Studio 3D (Tùy Chỉnh Nhân Vật Chuẩn Roblox)</h3>
      <ul>
        <li><b>Studio 3D Thời Gian Thực:</b> Xem trước nhân vật trong khung studio Three.js xoay 360 độ mượt mà bằng chuột hoặc cảm ứng trước khi vào phòng hoặc ngay khi đang chơi.</li>
        <li><b>Màu Da Từng Bộ Phận:</b> Tùy chọn đổi màu toàn thân hoặc chỉnh màu riêng cho từng phần (Đầu, Thân, Tay trái, Tay phải, Chân trái, Chân phải) theo bảng màu kinh điển của Roblox.</li>
        <li><b>Dáng Đầu & Khuôn Mặt 2D Classic:</b> Hỗ trợ đầu hộp vuông Classic Blocky R6, đầu tròn, anime dynamic, chibi cùng kho 9 decal biểu cảm (Smile, Trollface, Man Face lịch lãm, Smug, Kawaii Anime, Sunglasses,...).</li>
        <li><b>Tóc 3D & Bảng Nhuộm Đa Sắc:</b> Kiểu tóc gai anime, tóc layer bồng bềnh, đuôi ngựa, afro, mũ len beanie kèm bảng màu nhuộm phong phú.</li>
        <li><b>Trang Phục 3D Co Giãn (Layered Clothing) & 2D Classic:</b> Áo khoác Bomber, Trench coat, áo da biker, varsity, hoodie nỉ, chân váy xòe tennis, đầm dạ hội, giày sneaker thể thao, quần jeans rách, đồ camo.</li>
        <li><b>Đồng Bộ P2P Trực Tuyến:</b> Tự động lưu trữ trên trình duyệt và đồng bộ hóa ngoại hình cho tất cả bạn bè trong phòng cùng chiêm ngưỡng.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🌐 Sảnh Chờ Đa Phòng (Multi-Room Lobby)</h3>
      <ul>
        <li>Tự do tạo phòng công khai hoặc phòng riêng tư có <b>mật khẩu bảo vệ</b>.</li>
        <li>Nút mở nhanh <b>Studio Avatar 3D</b> ngay tại màn hình sảnh chờ để tân trang diện mạo trước khi tham gia trò chơi.</li>
        <li>Hỗ trợ link mời nhanh <code>#room=ten-phong</code> gửi cho bạn bè vào cùng phòng ngay lập tức.</li>
        <li>Bộ lọc danh mục sảnh theo chủ đề lễ hội.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🎙️ Voice Chat P2P & Spatial 3D Audio</h3>
      <ul>
        <li>Đàm thoại âm thanh trực tiếp qua <b>WebRTC P2P</b> với độ trễ cực thấp.</li>
        <li><b>Âm thanh không gian 3D</b>: lại gần nghe to, đi xa âm lượng nhỏ dần.</li>
        <li>Biểu tượng sóng âm VAD <code>🎙️</code> tự động phát sáng trên đầu khi bạn nói.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎰 Mật Thất Casino Multiplayer & Kinh Tế 0 Xu</h3>
      <ul>
        <li><b>Bức Tường Ảo Ảnh (Illusion Walls):</b> Cổng vào mật thất được giấu kín sau các bức tường bí mật trong góc khuất của cả 4 bản đồ, bấm <code>[E]</code> để dịch chuyển tức thời vào casino.</li>
        <li><b>Đồng Bộ Multiplayer Thời Gian Thực:</b> Cả phòng cùng quan sát và tương tác trên bàn cược Roulette 3D, đường đua vịt Duck Derby, bàn Blackjack chia bài, máy Slot kéo cần giật nổ hũ và Plinko thả bi mượt mà.</li>
        <li><b>Kinh Tế Xu Nghiêm Ngặt:</b> Người chơi bắt đầu phòng với <b>0 xu</b>, tìm kiếm các mảnh note dán tường bí mật (<code>"Raumania"</code>, <code>"BoKho"</code>, <code>"Chu0n6"</code>, <code>"Trung Legit"</code>, <code>"toilagay"</code>) để nạp 500 xu chơi casino.</li>
        <li>Quầy VIP Pub được bố trí hài hòa phía bên trái màn hình TV lớn.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛠️ Admin Studio, Lệnh Điều Khiển & Quái Thú Slime</h3>
      <ul>
        <li>Bảng điều khiển Admin tự động gợi ý lệnh thông minh theo từ khóa gõ vào (autocomplete commands & tên người chơi).</li>
        <li>Đóng modal tức thì khi chạy lệnh để theo dõi trọn vẹn kết quả trên không gian 3D.</li>
        <li>Lệnh troll độc lạ: <code>:truonggiang</code> triệu hồi khối slime cube 6 mặt nhảy tung tăng đuổi theo người chơi, <code>:dinnerbone</code> đảo ngược trọng lực cắm đầu xuống đất, <code>:clone</code>, <code>:btools</code>, <code>:guillotine</code>, <code>:telecasino</code>...</li>
        <li>Hào quang Admin rực rỡ và thông báo toàn server.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>👑 Bộ Sưu Tập 47 Danh Hiệu & Tìm Kiếm Trực Quan</h3>
      <ul>
        <li><b>Kho 47 Danh Hiệu Phong Phú:</b> Tuyển tập danh hiệu độc lạ (Faker, Sơn Tùng MTP, Hieuthuhai, Main Character, Báo thủ, Rick Astley, SpongeBob, Yasuo, Allain,...).</li>
        <li><b>Thanh Tìm Kiếm Real-Time:</b> Gõ từ khóa để lọc ngay lập tức danh hiệu yêu thích trên giao diện grid trực quan.</li>
        <li><b>Danh Hiệu GAY - Rainbow RGB 24/7:</b> Hiệu ứng dải màu quang phổ biến đổi liên tục 24/7 cả trên thẻ huy hiệu lẫn nhãn tên nhân vật trong không gian 3D.</li>
        <li><b>Splash Screen Thương Hiệu:</b> Màn hình chào với logo chính thức, hiệu ứng nhịp đập ánh sáng và thanh tải tiến trình mượt mà.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🐉 Thần Rồng Kim Long Khổng Lồ (Tết Giáp Thìn)</h3>
      <ul>
        <li>Nâng cấp quy mô Kim Long gấp <b>2.5 lần</b> với độ chi tiết hoành tráng vượt trội.</li>
        <li>Thân rồng gồm <b>14 đốt uốn lượn</b> mềm mại kèm vây lưng, sừng ngọc bích, hàm răng ngà và đôi râu lửa bập bùng.</li>
        <li>Quả cầu <b>Dạ Minh Châu</b> thần bí bay lượn hộ thân quanh đầu rồng tạo nên khung cảnh Tết đầy uy nghi.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>⛲ Suối Nguyện Ước Tình Yêu (Valentine Wishing Fountain)</h3>
      <ul>
        <li>Cơ chế đặc quyền độc nhất vô nhị chỉ có tại bản đồ Valentine: <b>Tung Đồng Xu Nguyện Ước Tình Yêu</b>.</li>
        <li>Phun trào pháo hoa và cột nước trái tim 3D huyền ảo.</li>
        <li>Ngẫu nhiên nhận lời ban phúc từ Cupid: <i>Hào Quang Trái Tim Vĩnh Cửu</i>, tăng tốc độ chạy +45%, lì xì may mắn +200 xu, danh hiệu tình yêu và cử chỉ hôn gió ngọt ngào.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📜 Săn Mã Code Dán Tường & Kinh Tế Chip</h3>
      <ul>
        <li>Người chơi bắt đầu với <b>0 xu</b> trong ví và phải tự mình đi săn tìm các <b>mảnh giấy ghi chú dán bí mật</b> khắp 4 bản đồ theo phong cách <i>"Find the button"</i>.</li>
        <li>Mỗi mảnh giấy chứa gợi ý giải đố ký tự và mã bí mật để nhận ngay 500 xu (hồi chiêu 10 phút mỗi mã).</li>
        <li>Bấm phím <code>C</code> hoặc nhấp vào ví tiền để nhập mã đổi xu bất cứ lúc nào.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>👑 Bộ Sưu Tập Danh Hiệu (Titles System)</h3>
      <ul>
        <li>Mở khóa các danh hiệu lấp lánh hiển thị trang trọng ngay trên đầu nhân vật.</li>
        <li>Danh hiệu độc quyền <b>"Vua Đỏ Đen"</b> dành cho cao thủ chinh phục Jackpot cả 5 trò chơi casino.</li>
        <li>Danh hiệu đặc biệt: <i>Bậc Thầy Đỏ Đen</i>, <i>Đại Phú Hào Las Vegas</i>, <i>Thợ Săn Mật Mã</i>, <i>Lễ Hội Vương</i>...</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🐉 Thần Rồng Kim Long Khổng Lồ (Tết Giáp Thìn)</h3>
      <ul>
        <li>Nâng cấp quy mô Kim Long gấp <b>2.5 lần</b> với độ chi tiết hoành tráng vượt trội.</li>
        <li>Thân rồng gồm <b>14 đốt uốn lượn</b> mềm mại kèm vây lưng, sừng ngọc bích, hàm răng ngà và đôi râu lửa bập bùng.</li>
        <li>Quả cầu <b>Dạ Minh Châu</b> thần bí bay lượn hộ thân quanh đầu rồng tạo nên khung cảnh Tết đầy uy nghi.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>⛲ Suối Nguyện Ước Tình Yêu (Valentine Wishing Fountain)</h3>
      <ul>
        <li>Cơ chế đặc quyền độc nhất vô nhị chỉ có tại bản đồ Valentine: <b>Tung Đồng Xu Nguyện Ước Tình Yêu</b>.</li>
        <li>Phun trào pháo hoa và cột nước trái tim 3D huyền ảo.</li>
        <li>Ngẫu nhiên nhận lời ban phúc từ Cupid: <i>Hào Quang Trái Tim Vĩnh Cửu</i>, tăng tốc độ chạy +45%, lì xì may mắn +200 xu, danh hiệu tình yêu và cử chỉ hôn gió ngọt ngào.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📜 Săn Mã Code Dán Tường & Kinh Tế Chip</h3>
      <ul>
        <li>Người chơi bắt đầu với <b>0 xu</b> trong ví và phải tự mình đi săn tìm các <b>mảnh giấy ghi chú dán bí mật</b> khắp 4 bản đồ theo phong cách <i>"Find the button"</i>.</li>
        <li>Mỗi mảnh giấy chứa gợi ý giải đố ký tự và mã bí mật để nhận ngay 500 xu (hồi chiêu 10 phút mỗi mã).</li>
        <li>Bấm phím <code>C</code> hoặc nhấp vào ví tiền để nhập mã đổi xu bất cứ lúc nào.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>👑 Bộ Sưu Tập Danh Hiệu (Titles System)</h3>
      <ul>
        <li>Mở khóa các danh hiệu lấp lánh hiển thị trang trọng ngay trên đầu nhân vật.</li>
        <li>Danh hiệu độc quyền <b>"Vua Đỏ Đen"</b> dành cho cao thủ chinh phục Jackpot cả 5 trò chơi casino.</li>
        <li>Danh hiệu đặc biệt: <i>Bậc Thầy Đỏ Đen</i>, <i>Đại Phú Hào Las Vegas</i>, <i>Thợ Săn Mật Mã</i>, <i>Lễ Hội Vương</i>...</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🧱 Tối Ưu Hóa Vật Lý & Triệt Tiêu Khoảng Trống (Zero Air Gap)</h3>
      <ul>
        <li>Cân chỉnh lại toàn bộ bán kính va chạm của tường và các đồ vật 3D trong 4 bản đồ.</li>
        <li>Người chơi có thể áp sát tường và nhảy đứng thăng bằng tự nhiên trên các bàn tiệc, bục chướng ngại vật mà không còn bị lơ lửng giữa không trung.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📱 Tối Ưu Hóa Điều Khiển Trên Di Động (Mobile)</h3>
      <ul>
        <li>Tự động nhận diện thiết bị cảm ứng và kích hoạt giao diện điều khiển chuyên dụng.</li>
        <li><b>Cần điều khiển ảo (Virtual Analog Joystick):</b> Điều hướng WASD 360 độ mượt mà.</li>
        <li><b>Cụm nút cảm ứng trực quan:</b> Nhảy vọt, Tương tác thông minh <code>[E]</code>, Bắn Minigame <code>[G]</code> và Menu Hoạt cảnh Emote <code>[F]</code>.</li>
        <li>Vuốt màn hình xoay góc nhìn camera linh hoạt.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🖥️ Rạp TV 3D & Chia Sẻ Màn Hình</h3>
      <ul>
        <li><b>Chiếu màn hình máy tính</b> (phím <code>P</code>) trực tiếp lên TV 3D cho cả phòng cùng xem.</li>
        <li>Đồng bộ video và nhạc YouTube theo thời gian thực.</li>
        <li>Hỗ trợ chế độ phóng to rạp chiếu phim (Cinema Mode).</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎨 4 Đại Chủ Đề Lễ Hội Tuyệt Đẹp</h3>
      <ul>
        <li>🎄 <b>Giáng Sinh:</b> Cây thông tuyết khổng lồ, lò sưởi nướng marshmallow, ném tuyết FPS.</li>
        <li>🎃 <b>Halloween:</b> Đại bí ngô, quầy hóa trang, Boss Vampire rình rập và khu an toàn 3D.</li>
        <li>🧧 <b>Tết Cổ Truyền:</b> Cây mai đại thụ, Kim Long pháo hoa rực rỡ mang tài lộc.</li>
        <li>💝 <b>Valentine:</b> Vườn hoa tình yêu, ghế đôi couple sofa, bắn cung Cupid ngắm tâm crosshair.</li>
      </ul>
    </td>
  </tr>
</table>

---

## ⌨️ Bảng Phím Tắt Điều Khiển

| Phím Tắt | Hành Động | Ghi Chú |
|:---:|:---|:---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Di chuyển nhân vật | Hỗ trợ cả 4 phím mũi tên và bộ gõ tiếng Việt |
| <kbd>Shift</kbd> (Giữ) | Chạy nhanh | Tăng tốc độ di chuyển gấp đôi |
| <kbd>Space</kbd> | Nhảy / Đứng dậy | Nhảy vượt chướng ngại vật hoặc rời ghế ngồi |
| <kbd>Chuột phải</kbd> / <kbd>L</kbd> | Khóa / Mở con trỏ chuột | Xoay camera mượt mà góc nhìn thứ 3 |
| <kbd>V</kbd> | Chuyển đổi góc nhìn | Góc nhìn thứ 3 (TPS) ↔ Góc nhìn thứ nhất (FPS) |
| <kbd>E</kbd> | Tương tác thông minh | Ngồi ghế, giải phong ấn mật thất, đọc mảnh giấy note, tương tác bạn bè |
| <kbd>G</kbd> | Kích hoạt Minigame | Ném tuyết, bắn cung Cupid, bắn pháo Kim Long |
| <kbd>F</kbd> | Menu Động Tác (Emotes) | Bật danh sách hoạt ảnh; bấm các phím từ 1-8 để duy trì tư thế |
| <kbd>C</kbd> | Nhập Mã Code Bí Mật | Đổi 500 xu cờ bạc từ các note giấy tìm được |
| <kbd>O</kbd> / <kbd>U</kbd> | Cài Đặt Âm Lượng & Độ Nhạy | Mở nhanh bảng tùy chỉnh âm thanh và chuột |
| <kbd>M</kbd> | Bật / Tắt Microphone | Voice chat trực tiếp thời gian thực |
| <kbd>P</kbd> | Chiếu màn hình lên TV | Chia sẻ màn hình máy tính / ứng dụng / tab trình duyệt |
| <kbd>Enter</kbd> | Nhập chat phòng | Bong bóng chat nổi trên đầu và khung chat lịch sử |

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Development)

Vì ứng dụng tải các Three.js ES Modules và mô hình 3D, bạn cần mở qua một HTTP Server cục bộ (không click đúp mở file qua giao thức `file://`):

### Cách 1: Sử dụng Python (khuyên dùng, không cần cài thêm thư viện)
```bash
# Mở terminal tại thư mục dự án Gather_Holidays
python3 -m http.server 8080
```
Sau đó truy cập trên trình duyệt: [http://localhost:8080](http://localhost:8080)

### Cập nhật model

Model Library trong trình duyệt hiện tạm đóng. Game chỉ dùng các model đã commit trong repository; hãy sửa tệp trong `design_model/`, cập nhật `design_model/model-library.json` khi cần, rồi push lên `main`. Cấu hình model cũ trong Local Storage sẽ không còn được áp dụng. Sau khi GitHub Pages deploy xong, tải lại trang bằng `Ctrl+Shift+R`.

### Cách 2: Sử dụng Node.js (`npx serve`)
```bash
npx serve .
```

---

## 📁 Cấu Trúc Mã Nguồn

```plaintext
Gather_Holidays/
├── assets/                  # Hình ảnh banner, logo, tranh phong ấn và mô hình 3D
│   ├── logo.jpg             # Logo chính thức của Gather Holidays 3D
│   ├── banner.jpg           # Ảnh bìa không gian lễ hội
│   ├── pin_note.jpg         # Giấy note dán tường bí mật
│   └── models/              # Mô hình nhân vật 3D
├── css/
│   ├── style.css            # Hiệu ứng ánh sáng, HUD dock, giao diện Mobile & Casino Arcade
│   ├── casino.css           # Giao diện bàn cược Roulette, Slot, Duck Derby, Plinko, Blackjack
│   └── avatar_customizer.css# Studio tùy biến nhân vật 3D, thanh trượt tỷ lệ, tab chọn trang phục
├── js/
│   ├── game.js              # Vòng lặp game, quản lý input, tương tác mật thất & câu đố logic
│   ├── avatar_customizer.js # Studio 3D nhân vật: da từng bộ phận, tóc 3D, trang phục co giãn, mặt 2D
│   ├── avatar.js            # Khung xương nhân vật, danh hiệu lấp lánh, hoạt ảnh emote, rig Roblox
│   ├── casino.js            # Hệ thống 5 máy Arcade Casino, kinh tế xu, jackpot & broadcast
│   ├── world.js             # Dựng bối cảnh 3D Three.js, phòng Casino Speakeasy, colliders
│   ├── props.js             # Đồ vật 3D procedural (bàn Roulette, máy Slot, cây thông...)
│   ├── maps.js              # Bản đồ ma trận, vị trí cổng bí mật và giấy note dán tường
│   ├── themes.js            # Cấu hình màu sắc, vật phẩm, trang phục của từng mùa lễ hội
│   ├── minigames.js         # Hệ thống Minigame PvP ném tuyết, cung Cupid, pháo Tết Kim Long
│   ├── audio.js             # Nhạc nền Speakeasy BGM, âm thanh thắng cược & SFX Web Audio
│   ├── rtc.js               # Động cơ WebRTC Voice Chat P2P, Spatial Audio & Screen Sharing
│   └── net.js               # Kết nối MQTT WebSocket đồng bộ trạng thái phòng
├── index.html               # Cấu trúc giao diện web, modal câu đố mật thất & điều khiển mobile
└── README.md                # Tài liệu dự án
```

---

## 📄 Bản Quyền & Giấy Phép

- Dự án được phát hành theo giấy phép **MIT License**.
- Tài nguyên 3D & thư viện âm thanh được tham chiếu chi tiết tại [CREDITS.md](CREDITS.md).

<div align="center">
  <sub>Được xây dựng với niềm đam mê dành cho cộng đồng yêu thích không gian 3D tương tác.</sub>
</div>
