# Migration Checklist

1. Backup thu muc hien tai truoc khi xoa.
2. Dam bao da cai Docker Desktop.
3. Trong `BongDaNgoaiHang.Com`, copy `.env.example` thanh `.env`.
4. Chay `docker compose up -d --build`.
5. Kiem tra:
   - `http://localhost:3000`
   - `http://localhost:3000/blog`
   - `http://localhost:3000/he-thong/quan-tri`
6. Chay test:
   - `npm test`
7. Khi da on dinh, dung script `tools/replace-current-project.ps1`.
