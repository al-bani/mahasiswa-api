# Script untuk test koneksi PostgreSQL dari Windows
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow

# Test dengan Docker
Write-Host "Testing connection via Docker..." -ForegroundColor Cyan
try {
    $result = docker-compose exec -T postgres psql -U postgres -d mahasiswa_db -c "SELECT current_user, current_database();"
    Write-Host "Docker connection successful" -ForegroundColor Green
    Write-Host $result
} catch {
    Write-Host "Docker connection failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test port connectivity
Write-Host "Testing port connectivity..." -ForegroundColor Cyan
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 5432)
    $tcpClient.Close()
    Write-Host "Port 5432 is accessible" -ForegroundColor Green
} catch {
    Write-Host "Port 5432 is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Connection test completed!" -ForegroundColor Green
