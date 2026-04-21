const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bongdangoaihang.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678';

const posts = [
    {
        title: 'Ngoại hạng Anh 2026: Lịch thi đấu, thể thức và điểm mới cần biết',
        slug: 'ngoai-hang-anh-2026-lich-thi-dau-the-thuc-diem-moi',
        excerpt:
            'Toàn cảnh Ngoại hạng Anh 2026: mốc thời gian, lịch thi đấu, thể thức và các thay đổi quan trọng với cuộc đua vô địch.',
        category: 'Ngoại hạng Anh',
        tags: ['ngoại hạng anh', 'lịch thi đấu', 'bóng đá anh', 'seo'],
        contentHtml:
            '<h2>Tổng quan mùa giải</h2><p>Ngoại hạng Anh 2026 bước vào giai đoạn cạnh tranh khốc liệt với lịch thi đấu dày và nhiều cuộc đối đầu trực tiếp giữa nhóm đầu bảng.</p><h2>Những mốc thời gian đáng chú ý</h2><ul><li>Giai đoạn mở màn có nhiều trận đại chiến.</li><li>Lịch Giáng sinh tiếp tục là thử thách thể lực.</li><li>Chặng nước rút quyết định cuộc đua top 4.</li></ul><h2>Cách theo dõi hiệu quả</h2><p>Người hâm mộ nên theo dõi lịch đấu theo vòng, đối chiếu phong độ 5 trận gần nhất và biến động BXH để có góc nhìn chính xác.</p>',
        status: 'published'
    },
    {
        title: 'Bảng xếp hạng La Liga mới nhất: Cuộc đua vô địch và top 4',
        slug: 'bang-xep-hang-la-liga-moi-nhat-cuoc-dua-vo-dich-top-4',
        excerpt:
            'Phân tích bảng xếp hạng La Liga mới nhất, cơ hội vô địch của nhóm đầu và cuộc cạnh tranh suất dự cúp châu Âu.',
        category: 'La Liga',
        tags: ['la liga', 'bảng xếp hạng', 'top 4', 'seo'],
        contentHtml:
            '<h2>Diễn biến nhóm đầu</h2><p>La Liga đang chứng kiến khoảng cách điểm số sít sao giữa các đội dẫn đầu, tạo ra cuộc đua vô địch hấp dẫn đến những vòng cuối.</p><h2>Yếu tố quyết định thứ hạng</h2><ul><li>Hiệu số bàn thắng bại.</li><li>Kết quả đối đầu trực tiếp.</li><li>Độ ổn định trên sân khách.</li></ul><h2>Dự báo giai đoạn tới</h2><p>Lịch đấu với mật độ cao sẽ là bài kiểm tra chiều sâu đội hình, đặc biệt với các CLB còn chinh chiến ở cúp châu Âu.</p>',
        status: 'published'
    },
    {
        title: 'Lịch thi đấu FA Cup hôm nay: Trận đáng xem và nhận định nhanh',
        slug: 'lich-thi-dau-fa-cup-hom-nay-tran-dang-xem-nhan-dinh',
        excerpt:
            'Cập nhật lịch thi đấu FA Cup hôm nay, các trận tâm điểm, thống kê trước trận và nhận định nhanh cho người xem.',
        category: 'FA Cup',
        tags: ['fa cup', 'lịch thi đấu hôm nay', 'nhận định bóng đá'],
        contentHtml:
            '<h2>Những trận tâm điểm</h2><p>FA Cup luôn tiềm ẩn bất ngờ khi các đội hạng dưới có thể tạo địa chấn trước những tên tuổi lớn.</p><h2>Điểm cần theo dõi</h2><ul><li>Thay đổi đội hình vì lịch dày.</li><li>Khả năng luân chuyển nhân sự.</li><li>Phong độ hàng công hai đội.</li></ul><h2>Gợi ý theo dõi</h2><p>Ưu tiên các trận có chênh lệch phong cách chơi rõ rệt để nhận diện cơ hội bùng nổ bàn thắng.</p>',
        status: 'published'
    },
    {
        title: 'Cúp C1 châu Âu: Phân tích cặp đấu lớn và cơ hội đi tiếp',
        slug: 'cup-c1-chau-au-phan-tich-cap-dau-lon-co-hoi-di-tiep',
        excerpt:
            'Phân tích chuyên sâu các cặp đấu lớn tại Cúp C1 châu Âu, lợi thế chiến thuật và xác suất đi tiếp của từng đội.',
        category: 'Cúp C1',
        tags: ['cúp c1', 'champions league', 'phân tích trận đấu'],
        contentHtml:
            '<h2>Bức tranh chiến thuật</h2><p>Các trận knock-out Cúp C1 thường được định đoạt bởi khả năng kiểm soát nhịp độ và sự khác biệt ở những tình huống chuyển trạng thái.</p><h2>Đội nào đang có lợi thế?</h2><ul><li>Đội sở hữu hàng tiền vệ giàu năng lượng.</li><li>Đội có hiệu suất dứt điểm cao.</li><li>Đội giữ sạch lưới ổn định.</li></ul><h2>Kết luận</h2><p>Cơ hội đi tiếp không chỉ phụ thuộc ngôi sao mà còn nằm ở sự cân bằng đội hình và tính kỷ luật chiến thuật.</p>',
        status: 'published'
    },
    {
        title: 'Serie A tuần này: Lịch đấu, phong độ và đội hình dự kiến',
        slug: 'serie-a-tuan-nay-lich-dau-phong-do-doi-hinh-du-kien',
        excerpt:
            'Toàn bộ thông tin Serie A tuần này gồm lịch đấu chi tiết, phong độ 5 trận gần nhất và đội hình dự kiến của các CLB lớn.',
        category: 'Serie A',
        tags: ['serie a', 'lịch đấu bóng đá', 'đội hình dự kiến'],
        contentHtml:
            '<h2>Lịch đấu đáng chú ý</h2><p>Serie A tuần này có nhiều cặp đấu then chốt ảnh hưởng trực tiếp đến cuộc đua vô địch và suất dự cúp châu Âu.</p><h2>Phân tích phong độ</h2><ul><li>Đội có chuỗi bất bại dài thường kiểm soát thế trận tốt.</li><li>Đội bóng phòng ngự phản công có thể tạo bất ngờ.</li><li>Yếu tố sân nhà tiếp tục đóng vai trò quan trọng.</li></ul><h2>Đội hình dự kiến</h2><p>Những thay đổi ở tuyến giữa và hai biên sẽ là điểm nhấn chiến thuật trong tuần thi đấu này.</p>',
        status: 'published'
    }
];

async function run() {
    const loginRes = await axios.post(`${BASE}/api/auth/login`, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    const existingRes = await axios.get(`${BASE}/api/blog/admin/posts?status=all`, { headers });
    const slugs = new Set(posts.map((p) => p.slug));
    const toDelete = existingRes.data.filter((p) => slugs.has(p.slug));
    for (const p of toDelete) {
        await axios.delete(`${BASE}/api/blog/posts/${p._id}`, { headers });
    }

    for (const post of posts) {
        await axios.post(`${BASE}/api/blog/posts`, post, { headers });
        console.log(`Created: ${post.title}`);
    }
    console.log(`DONE: created ${posts.length} posts`);
}

run().catch((err) => {
    console.error('Seed error:', err.response?.data || err.message);
    process.exit(1);
});
