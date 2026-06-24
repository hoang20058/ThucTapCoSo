# Step 1: Base image với Node.js LTS
FROM node:20-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả devDependencies phục vụ compile/build)
RUN npm install

# Sao chép toàn bộ mã nguồn dự án vào container
COPY . .

# Expose cổng 5173 (Frontend Vite) và 3001 (Faucet API Server)
EXPOSE 5173 3001

# Command mặc định để khởi chạy ứng dụng ở chế độ development
CMD ["npm", "run", "dev", "--", "--host"]
