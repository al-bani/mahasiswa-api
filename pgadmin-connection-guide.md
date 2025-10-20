# 🔧 Panduan Koneksi pgAdmin ke Database Docker

## 🚨 **Masalah yang Ditemukan:**

Error "password authentication failed" terjadi karena konfigurasi authentication PostgreSQL di Docker.

## ✅ **Solusi yang Sudah Dibuat:**

### **User Baru untuk pgAdmin:**

- **Username:** `pgadmin_user`
- **Password:** `pgadmin123`
- **Permissions:** SUPERUSER, CREATEDB, CREATEROLE

## 🎯 **Konfigurasi pgAdmin yang Benar:**

### **Option 1: Gunakan User Baru (Recommended)**

```
Host: 127.0.0.1
Port: 5432
Database: mahasiswa_db
Username: pgadmin_user
Password: pgadmin123
```

### **Option 2: Gunakan User Postgres dengan IP 127.0.0.1**

```
Host: 127.0.0.1
Port: 5432
Database: mahasiswa_db
Username: postgres
Password: postgres123
```

### **Option 3: Gunakan User Postgres tanpa Password**

```
Host: 127.0.0.1
Port: 5432
Database: mahasiswa_db
Username: postgres
Password: (kosong)
```

## 🧪 **Test Koneksi:**

Setelah berhasil koneksi, jalankan query ini:

```sql
-- Test koneksi
SELECT current_user, current_database(), version();

-- Lihat semua user
SELECT usename, usecreatedb, usesuper FROM pg_user;

-- Lihat tabel yang ada
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

## 📊 **Insert Sample Data:**

```sql
-- Insert admin sample
INSERT INTO "Admin" (username, email, password, status) VALUES
('admin', 'admin@example.com', '$2a$10$rOZJ8QxqJ8QxqJ8QxqJ8Qe', 1);

-- Insert mahasiswa sample
INSERT INTO "Mahasiswa" (
    name, email, phone_number, fakultas, jurusan, birth, gender, image, city
) VALUES
('John Doe', 'john@example.com', '081234567890', 'Teknik', 'Informatika', '2000-01-01', 'L', 'john.jpg', 'Jakarta'),
('Jane Smith', 'jane@example.com', '081234567891', 'Ekonomi', 'Manajemen', '2001-02-15', 'P', 'jane.jpg', 'Bandung');
```

## 🔍 **Troubleshooting:**

### **Jika Masih Error:**

1. **Restart pgAdmin** sepenuhnya
2. **Check firewall** Windows
3. **Test port:** `telnet 127.0.0.1 5432`
4. **Restart Docker container:**
   ```bash
   docker-compose restart postgres
   ```

### **Alternative: Gunakan Adminer (Lebih Ringan)**

Jika pgAdmin masih bermasalah, gunakan Adminer:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Akses: `http://localhost:8080`

**Login Adminer:**

- Server: `postgres`
- Username: `postgres` atau `pgadmin_user`
- Password: `postgres123` atau `pgadmin123`
- Database: `mahasiswa_db`

## 🎯 **Langkah Selanjutnya:**

1. **Coba koneksi dengan `pgadmin_user`** terlebih dahulu
2. **Jika berhasil, insert sample data**
3. **Test API dashboard** untuk memastikan data tersimpan
4. **Gunakan pgAdmin untuk development** selanjutnya

## 📋 **Quick Reference:**

| Method             | Host      | Username     | Password    | Notes        |
| ------------------ | --------- | ------------ | ----------- | ------------ |
| pgAdmin (New User) | 127.0.0.1 | pgadmin_user | pgadmin123  | Recommended  |
| pgAdmin (Postgres) | 127.0.0.1 | postgres     | postgres123 | Alternative  |
| pgAdmin (No Pass)  | 127.0.0.1 | postgres     | (kosong)    | Last resort  |
| Adminer            | postgres  | postgres     | postgres123 | Docker-based |
