# วิธีกู้คืนข้อมูล Supabase

## 1. เช็ค Daily Backups (Free Plan)
1. เข้า Supabase Dashboard: https://supabase.com/dashboard
2. เลือก Project
3. ไปที่ Settings → Database
4. มองหา "Database Backups" section
5. ดู backup ที่มี (Free plan เก็บ 7 วันล่าสุด)

## 2. Restore จาก Backup
```bash
# Download backup file (.sql)
# จาก Supabase Dashboard → Database → Backups → Download

# Restore ผ่าน Supabase CLI
npx supabase db restore --project-ref <your-project-ref> --file backup.sql

# หรือ Restore ผ่าน SQL Editor
# 1. เปิด SQL Editor ใน Supabase Dashboard
# 2. Paste SQL จาก backup file
# 3. Run
```

## 3. ถ้าไม่มี Backup - Recreate Schema
```bash
# Run migrations ใหม่เพื่อ recreate tables
cd migrations/
# Run ทีละไฟล์ตามลำดับใน Supabase SQL Editor
```

## 4. ถ้ามี CSV/JSON Export
# Import ผ่าน Supabase Table Editor
# หรือใช้ scripts/sync-directory-to-supabase.mjs
