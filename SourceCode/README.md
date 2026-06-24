# 🔐 Web2.5 DApp Password Manager

Ứng dụng quản lý mật khẩu phân tán Web2.5 (lai ghép Web2 và Web3), an toàn và hiện đại. Ứng dụng mang lại sự tiện lợi của Web2 (đăng nhập Google, giao diện trực quan) kết hợp tính bảo mật tối đa của Web3 (mã hóa client-side AES-256-GCM, lưu trữ IPFS phi tập trung, ghi nhận chữ ký blockchain Ethereum).

---

## 🗺️ Mục Lục

| # | Phần | Mô tả |
|---|------|-------|
| 1 | [⚡ Chạy Nhanh (Đã Có Sẵn Cấu Hình)](#-chạy-nhanh-đã-có-sẵn-cấu-hình) | Dành cho máy đã cài Node.js và file `.env` sẵn sàng |
| 2 | [💾 Hướng Dẫn Cài Đặt Từ Máy Windows Sạch](#-hướng-dẫn-cài-đặt-từ-máy-windows-sạch) | Bước 1–7 từ đầu đến cuối |
| 3 | [📖 Hướng Dẫn Sử Dụng Ứng Dụng](#-hướng-dẫn-sử-dụng-ứng-dụng) | Đăng nhập, quản lý két sắt, import/export |
| 4 | [📂 Dữ Liệu Mẫu Kiểm Thử](#-dữ-liệu-mẫu-kiểm-thử) | File mẫu plaintext và ciphertext |
| 5 | [🐳 Triển Khai Docker (Tùy Chọn)](#-triển-khai-docker-tùy-chọn) | Đóng gói container |
| 6 | [📐 Tài Liệu Kỹ Thuật Tham Khảo](#-tài-liệu-kỹ-thuật-tham-khảo) | Tech stack, kiến trúc, bảo mật, cấu trúc thư mục |

---

## ⚡ Chạy Nhanh (Đã Có Sẵn Cấu Hình)

> Phần này dành cho người đã cài Node.js và dự án **đã có sẵn file `.env`** đầy đủ thông số.
> Nếu máy bạn chưa có gì, hãy bỏ qua và đi thẳng tới [Hướng Dẫn Cài Đặt Từ Máy Windows Sạch](#-hướng-dẫn-cài-đặt-từ-máy-windows-sạch).

**Terminal 1** – Cài thư viện:
```bash
npm install
```

**Terminal 2** – Chạy trạm cấp gas (giữ terminal này mở):
```bash
npm run faucet
```
> Faucet server chạy tại cổng `3001`, tự động tài trợ Sepolia ETH cho ví ảo Google.

**Terminal 3** – Chạy giao diện:
```bash
npm run dev
```
> Mở trình duyệt tại [http://localhost:5173](http://localhost:5173).

---

## 💾 Hướng Dẫn Cài Đặt Từ Máy Windows Sạch

Hướng dẫn dưới đây dành cho máy **chưa từng cài bất kỳ phần mềm lập trình nào**. Hãy làm theo **tuần tự từ Bước 1 đến Bước 7**.

---

### 🧱 BƯỚC 1 — Cài Đặt Phần Mềm Nền Tảng

Bạn cần cài đặt **3 phần mềm bắt buộc** trước khi bắt đầu:

#### 1.1. Cài đặt Node.js (Bắt buộc)

| | |
|---|---|
| **Link tải** | [https://nodejs.org](https://nodejs.org) → Nhấn nút **LTS** (ví dụ `20.18.0 LTS`) |
| **Cách cài** | Mở file `.msi` → Nhấn **Next** liên tục → Tích ô "Automatically install the necessary tools..." → **Install** |
| **Kiểm tra** | Mở **Command Prompt** (Win + R → gõ `cmd` → Enter), gõ: |

```cmd
node -v
npm -v
```
*Nếu hiển thị phiên bản (ví dụ `v20.18.0` và `10.x.x`) là thành công.*

#### 1.2. Cài đặt Git (Bắt buộc)

| | |
|---|---|
| **Link tải** | [https://git-scm.com/download/win](https://git-scm.com/download/win) → Chọn **64-bit Git for Windows Setup** |
| **Cách cài** | Mở file cài đặt → Nhấn **Next** liên tục (giữ mặc định) → **Install** |
| **Kiểm tra** | Mở Command Prompt, gõ: |

```cmd
git --version
```

#### 1.3. Cài đặt VS Code (Khuyên dùng)

| | |
|---|---|
| **Link tải** | [https://code.visualstudio.com](https://code.visualstudio.com) → **Download for Windows** |
| **Cách cài** | Chạy file cài đặt → Nhấn **Next** → **Install** |

---

### 📥 BƯỚC 2 — Tải Mã Nguồn Dự Án

Mở **Command Prompt** hoặc **Terminal trong VS Code**, chạy:

```bash
git clone https://github.com/hoang20058/Password_manager_dapp_develop.git
cd Password_manager_dapp_develop
```

> Hoặc nếu bạn đã có thư mục dự án (được cung cấp qua USB/ZIP), hãy mở VS Code → **File** → **Open Folder...** → Chọn thư mục dự án.

---

### 🔥 BƯỚC 3 — Thiết Lập Dịch Vụ Bên Ngoài

Ứng dụng cần 3 dịch vụ bên ngoài. Bạn sẽ lấy thông số cấu hình từ mỗi dịch vụ để điền vào Bước 4.

#### 3A. Firebase Authentication (Đăng nhập Google)

> [!TIP]
> **TÙY CHỌN NHANH:** Tác giả đã cấu hình sẵn một Firebase sandbox. Nếu bạn chỉ muốn kiểm thử nhanh, hãy **bỏ qua mục 3A** và dùng trực tiếp các giá trị có sẵn trong file `.env` ở Bước 4.
>
> *Tài khoản Firebase sandbox đã được bảo mật nghiêm ngặt: chỉ bật Google Auth, giới hạn domain `localhost`/`127.0.0.1`, chặn mọi quyền ghi cơ sở dữ liệu bên thứ ba. An toàn cho kiểm thử đồ án.*

**Nếu muốn tự tạo Firebase riêng:**

1. Truy cập [Firebase Console](https://console.firebase.google.com/) → Đăng nhập Gmail.
2. **Add project** → Đặt tên (ví dụ: `web3-password-manager`) → Tắt Google Analytics → **Create project**.
3. Menu trái: **Build** → **Authentication** → **Get Started** → Tab **Sign-in method** → Bật **Google** → Chọn email hỗ trợ → **Save**.
4. Quay về **Project Overview** → Nhấn biểu tượng Web (`</>`) → Đặt tên app → **Register app**.
5. Sao chép 7 giá trị `firebaseConfig` ra Notepad:
   ```
   apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId, measurementId
   ```

#### 3B. Pinata IPFS (Lưu trữ dữ liệu mã hóa phi tập trung)

1. Truy cập [https://www.pinata.cloud](https://www.pinata.cloud/) → **Sign Up** miễn phí.
2. Sau khi đăng nhập → Menu trái: **API Keys** → **Create New Key**.
3. Tích chọn quyền **Admin** → Đặt tên (ví dụ: `DappKey`) → **Generate Key**.
4. **Sao chép chuỗi JWT** (chuỗi dài bắt đầu bằng `eyJhbGci...`) ra Notepad.

> ⚠️ Chuỗi JWT chỉ hiển thị **một lần duy nhất**. Nếu quên lưu, bạn phải tạo key mới.

#### 3C. Ví MetaMask & Sepolia ETH (Blockchain)

> MetaMask **chỉ cần thiết** nếu bạn muốn:
> - Đăng nhập bằng ví MetaMask (thay vì Google), hoặc
> - Tự deploy Smart Contract mới.
>
> Nếu dự án **đã có sẵn `VITE_VAULT_CONTRACT_ADDRESS` và `DEPLOYER_PRIVATE_KEY`** trong file `.env`, bạn có thể **bỏ qua mục 3C**.

1. Cài **MetaMask** extension: [https://metamask.io/download](https://metamask.io/download/) → **Add to Chrome** → Tạo ví mới → **Lưu 12 từ khôi phục ra giấy** (cực kỳ quan trọng).

2. **Bật mạng Sepolia:**
   - Mở MetaMask → tìm nút menu Nhấp dropdown chọn networks mạng (góc trên trái).
   - Bật **Show test networks** → Chọn **Sepolia**.

3. **Nhận Sepolia ETH miễn phí:**
   - Copy địa chỉ ví (nhấp vào biểu tượng copy dưới tên tài khoản ở MetaMask để copy - dạng 0x22... là địa chỉ ví).
   - Truy cập faucet:
     - [Alchemy Faucet](https://sepoliafaucet.com/) (khuyên dùng) — Cần tạo tài khoản Alchemy miễn phí.
     - [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) — Không cần đăng ký.
   - Dán địa chỉ ví → Nhấn **Send** → Chờ 1-2 phút.

4. **Lấy Private Key** (cần cho deploy Smart Contract):
   - MetaMask -> dropdown ở phần tên ví → 3 chấm ở tên ví → **Account details** → **Show private key** → Nhập mật khẩu MetaMask → Copy chuỗi ký tự.
   - Lưu ra Notepad để dùng ở Bước 4.

---

### 📝 BƯỚC 4 — Cấu Hình File `.env`

1. Trong VS Code, tìm file **`.env.example`** ở thư mục gốc dự án.
2. **Sao chép** file này thành `.env`:
   - Click chuột phải `.env.example` → **Copy** → Click chuột phải khoảng trống → **Paste** → Đổi tên thành `.env`.
   - Hoặc chạy lệnh:
     ```bash
     copy .env.example .env
     ```
3. Mở file `.env` và điền thông số:

```env
# ========== CẤU HÌNH ỨNG DỤNG ==========
VITE_APP_NAME=Password Manager Vault
VITE_APP_LOCALE=vi-VN
VITE_DEFAULT_MASTER_PASSWORD=

# ========== FIREBASE (Bước 3A) ==========
# Dùng giá trị sandbox có sẵn bên dưới, hoặc thay bằng Firebase riêng của bạn
VITE_FIREBASE_API_KEY=AIzaSyDyjfSSJVoJhR_C1qGMo1-JRAYlv4iUuEU
VITE_FIREBASE_AUTH_DOMAIN=web3passwordmanager.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=web3passwordmanager
VITE_FIREBASE_STORAGE_BUCKET=web3passwordmanager.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=460811530088
VITE_FIREBASE_APP_ID=1:460811530088:web:0a8eb3570239a7946470dd
VITE_FIREBASE_MEASUREMENT_ID=G-SX2QPY31LC

# ========== PINATA IPFS (Bước 3B) ==========
VITE_PINATA_JWT="eyJhbGci... (dán chuỗi JWT Pinata của bạn vào đây)"
VITE_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# ========== BLOCKCHAIN (Bước 3C) ==========
VITE_VAULT_CONTRACT_ADDRESS="0x223....." (dán địa chỉ ví)
VITE_NETWORK_CHAIN_ID=11155111
VITE_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# ========== DEPLOY (Chỉ cần khi deploy Smart Contract mới) ==========
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY="dán Private Key MetaMask của bạn vào đây"
```

4. Nhấn **Ctrl + S** để lưu file.

> [!WARNING]
> **Không bao giờ commit file `.env` chứa Private Key hoặc JWT thật lên Git.** File `.gitignore` đã được cấu hình để bỏ qua `.env`.

---

### 📦 BƯỚC 5 — Cài Đặt Thư Viện

Mở Terminal trong VS Code (**Terminal** → **New Terminal**), chạy:

```bash
npm install
```

*Chờ khoảng 1-2 phút để tải toàn bộ thư viện. Khi hoàn tất, thư mục `node_modules/` sẽ xuất hiện.*

---

### 🚀 BƯỚC 6 — Biên Dịch & Triển Khai Smart Contract

> Bước này **chỉ cần làm một lần** khi dự án chưa có `VITE_VAULT_CONTRACT_ADDRESS` trong file `.env`.
> Nếu file `.env` đã có sẵn địa chỉ contract, hãy **bỏ qua** và đi thẳng Bước 7.

#### 6.1. Biên dịch Smart Contract
```bash
npm run compile
```
*Kết quả mong đợi: `Compiled 1 Solidity file successfully`.*

#### 6.2. Triển khai lên Sepolia Testnet
```bash
npm run deploy:sepolia
```
*Kết quả mong đợi:*
```
🔨 Deploying VaultPointer contract to Sepolia...
✅ VaultPointer deployed successfully!
📍 Contract Address: 0x1704...
✅ .env updated with contract address
✅ ABI exported to src/contracts/VaultPointer.abi.json
```

Script sẽ **tự động ghi** `VITE_VAULT_CONTRACT_ADDRESS` vào file `.env` và xuất file ABI cho frontend.

---

### ⛽ BƯỚC 7 — Khởi Chạy Ứng Dụng

Cần chạy **2 tiến trình song song** trên 2 terminal riêng:

#### Terminal 1 — JIT Gas Station Faucet (Cổng 3001)
```bash
npm run faucet
```
*Kết quả: `JIT Gas Station Faucet listening on port 3001`.*

> ⚠️ **Giữ terminal này mở** trong suốt quá trình sử dụng. Faucet tự động cấp 0.002 Sepolia ETH cho ví ảo Google khi số dư dưới 0.001 ETH.

#### Terminal 2 — Frontend Client (Cổng 5173)

Nhấn biểu tượng **`+`** ở góc trên phải khung terminal để mở tab mới, rồi chạy:

```bash
npm run dev
```

*Kết quả: `Local: http://localhost:5173/`*

**Giữ Ctrl và click vào link** để mở ứng dụng trên trình duyệt. 🎉

---

## 📖 Hướng Dẫn Sử Dụng Ứng Dụng

### 1. Đăng Nhập

Ứng dụng hỗ trợ 2 phương thức đăng nhập:

| Phương thức | Mô tả | Yêu cầu |
|-------------|--------|----------|
| **Đăng nhập Google** | Hệ thống tự động sinh ví Web3 ảo tất định từ tài khoản Google. Faucet tự cấp gas. | Chỉ cần tài khoản Gmail |
| **Kết nối MetaMask** | Kết nối ví MetaMask trực tiếp, người dùng tự quản lý gas. | Đã cài MetaMask + có Sepolia ETH |

### 2. Tạo Master Password (Lần đầu)

- Nhập mật khẩu chủ đủ mạnh (khuyến nghị ≥ 8 ký tự, có chữ hoa, số, ký tự đặc biệt).
- Hệ thống hiển thị thanh đánh giá cường độ mật khẩu bằng zxcvbn (score ≥ 3 mới được chấp nhận).
- Nhấn **Đăng ký két sắt** để khởi tạo.

### 3. Quản Lý Mật Khẩu Trong Két Sắt

- **Thêm mật khẩu:** Nhấn **Thêm mật khẩu** → Nhập URL, Username, Password, chọn Danh mục → **Lưu**.
- **Luồng đồng bộ khi Lưu:** Mã hóa AES-256-GCM cục bộ → Upload ciphertext lên IPFS → Faucet cấp gas (nếu dùng Google) → Ghi CID lên blockchain → Lưu cache IndexedDB.
- **Tìm kiếm & Lọc:** Tìm theo URL hoặc username, lọc theo danh mục.
- **Sửa / Xóa:** Nhấn vào bản ghi để chỉnh sửa hoặc xóa.

### 4. Mở Khóa Phiên & Auto-Lock

- Khi tải lại trang (F5) hoặc sau thời gian không tương tác, két sắt tự động khóa.
- Nhập Master Password để mở khóa lại.
- Cấu hình thời gian Auto-Lock tại **Cài đặt → Bảo mật**.

### 5. Đổi Master Password (Key Rotation)

Tại **Cài đặt → Bảo mật**:
1. Nhập mật khẩu hiện tại và mật khẩu mới.
2. Nhấn cập nhật → Hệ thống giải mã dữ liệu, sinh khóa mới, mã hóa lại và đồng bộ lên IPFS & Blockchain.

### 6. Nhập & Xuất Dữ Liệu

- **Xuất (Export):** Nhập Master Password xác nhận → Tải file JSON mã hóa định dạng `vault-ciphertext-v1`.
- **Nhập (Import):**
  - File mã hóa `vault-ciphertext-v1` → Nhập mật khẩu giải mã → **Giải mã & Nhập**.
  - File plaintext JSON cũ (mảng JSON) → Nhấn **Bỏ qua (Skip)** để import trực tiếp.

---

## 📂 Dữ Liệu Mẫu Kiểm Thử

Thư mục **`data_example/`** chứa các file mẫu để kiểm thử tính năng Import:

### 1. File Plaintext Legacy (Dạng thô chưa mã hóa)

| | |
|---|---|
| **File** | `data_example/mau_plaintext_legacy.json` |
| **Nội dung** | Mảng JSON chứa 3 tài khoản mẫu (Facebook, Google, GitHub) |
| **Cách import** | Vào **Nhập dữ liệu** → Chọn file → Nhấn **Bỏ qua (Skip)** |

### 2. File Ciphertext v1 (Dạng đã mã hóa)

| | |
|---|---|
| **File** | `data_example/data_mau_ma_hoa.json` |
| **Thuật toán** | AES-256-GCM + PBKDF2 (310,000 vòng) |
| **Mật khẩu giải mã** | **`Hoang2005@`** |
| **Cách import** | Vào **Nhập dữ liệu** → Chọn file → Nhập mật khẩu `Hoang2005@` → **Giải mã & Nhập** |

---

## 🐳 Triển Khai Docker (Tùy Chọn)

Ứng dụng hỗ trợ chạy đồng thời Frontend và Faucet qua Docker Compose.

**Yêu cầu:** Đã cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) trên Windows.

```bash
# Khởi chạy 2 container
docker compose up --build -d

# Kiểm tra container đang chạy
docker compose ps

# Tắt hệ thống
docker compose down
```

| Container | Cổng | Vai trò |
|-----------|------|---------|
| `dapp_password_manager_frontend` | 5173 | Vite dev server (hỗ trợ HMR) |
| `dapp_password_manager_faucet` | 3001 | JIT Gas Station Faucet |

---

## 📐 Tài Liệu Kỹ Thuật Tham Khảo

### Công Nghệ Sử Dụng (Tech Stack)

| Lớp | Công nghệ | Phiên bản |
|-----|-----------|-----------|
| Frontend | React, Vite, React Router, Tailwind CSS | 19, 8, 7, 3 |
| Mã hóa & Bảo mật | Web Crypto API, @zxcvbn-ts | Native, 3.x |
| Blockchain | Ethers.js, MetaMask API (EIP-1193) | 6.x |
| Smart Contract | Solidity, Hardhat | 0.8.19, 2.28 |
| Xác thực | Firebase Authentication | 12.x |
| Lưu trữ phân tán | IPFS (Pinata API) | — |
| Cache cục bộ | IndexedDB, localStorage | Native |

---

### Giải Thích Thư Viện (Dependencies)

#### Thư viện Runtime
| Thư viện | Vai trò |
|----------|---------|
| `react` & `react-dom` (v19) | Xây dựng giao diện component-based |
| `react-router-dom` (v7) | Định tuyến SPA không tải lại trang |
| `ethers` (v6) | Tương tác blockchain Ethereum (Wallet, Signer, Provider, Contract) |
| `firebase` (v12) | Xác thực Google Auth, lấy UID để sinh ví tất định |
| `lucide-react` (v1) | Bộ icon vector hiện đại cho giao diện |
| `@zxcvbn-ts/core` & `language-common` (v3) | Chấm điểm độ mạnh mật khẩu cục bộ (phát triển bởi Dropbox) |

#### Thư viện Phát triển
| Thư viện | Vai trò |
|----------|---------|
| `hardhat` & `@nomicfoundation/hardhat-toolbox` | Biên dịch Solidity, deploy Smart Contract |
| `vite` & `@vitejs/plugin-react` | Bundler thế hệ mới, Hot Module Replacement |
| `tailwindcss`, `postcss`, `autoprefixer` | Thiết kế CSS bằng utility classes |
| `dotenv` (v16) | Tải biến môi trường từ file `.env` |

---

### Cấu Trúc Thư Mục Dự Án

```text
exercise2_WP/
├── contracts/                  # Smart Contract Solidity
│   └── VaultPointer.sol        # Contract lưu IPFS CID cho từng ví
├── scripts/                    # Scripts triển khai blockchain (Hardhat)
│   ├── deploy.js               # Deploy contract & tự động ghi .env
│   ├── exportAbi.js            # Xuất file ABI JSON cho frontend
│   └── updateEnv.js            # Tiện ích ghi địa chỉ contract vào .env
├── server/                     # JIT Gas Faucet Server
│   └── faucet.js               # Node server tài trợ phí gas tự động
├── src/                        # Mã nguồn Frontend
│   ├── app/                    # Định tuyến React Router
│   ├── components/             # Components UI
│   │   ├── security/           # Cổng xác thực MasterPassword & check độ mạnh
│   │   └── vault/              # Panel quản lý mật khẩu chính
│   ├── config/                 # Cấu hình Firebase SDK
│   ├── context/                # AppContext: session, khóa RAM, đồng bộ
│   ├── contracts/              # File ABI của contract sau biên dịch
│   ├── services/               # Lớp giao tiếp (auth, blockchain, IPFS, faucet, vault)
│   ├── utils/                  # Tiện ích (mã hóa crypto.js, kiểm tra zxcvbn)
│   └── main.jsx                # Điểm khởi động React
├── data_example/               # Dữ liệu mẫu kiểm thử Import
├── docs/                       # Tài liệu kỹ thuật chi tiết
├── Dockerfile                  # Đóng gói container
├── docker-compose.yml          # Multi-container (Frontend + Faucet)
├── .env.example                # Mẫu file biến môi trường
└── package.json                # Khai báo thư viện & scripts
```

---

### Kiến Trúc Hệ Thống

#### Mô hình xác thực lai (Hybrid Authentication)
- **MetaMask:** Kết nối ví trực tiếp, người dùng tự quản lý khóa riêng tư.
- **Google Auth:** Đăng nhập qua Firebase, hệ thống sinh ví Web3 tất định trên RAM từ: `ethers.id("dapp_secret_salt_" + uid + email)`.

#### Phân lớp phần mềm
- **Presentation Layer:** `ShellLayout.jsx` bao bọc định tuyến, `MasterPasswordGate` kiểm soát tác vụ nhạy cảm.
- **Business Layer:** `AppContext.jsx` quản lý session key trên RAM và auto-lock. `vaultService.js` điều phối mã hóa, IndexedDB và đồng bộ Web3.
- **Data & Utility Layer:** `crypto.js` thực hiện PBKDF2 + AES-256-GCM. `password.js` đánh giá entropy mật khẩu.

#### Luồng lưu trữ dữ liệu
```
Người dùng nhập mật khẩu
    → Mã hóa AES-256-GCM trên trình duyệt (client-side)
    → Upload ciphertext lên IPFS → Nhận CID
    → Ghi CID lên Smart Contract Sepolia
    → Cache ciphertext vào IndexedDB (offline)
```

---

### Thiết Kế An Toàn Thông Tin

#### Nguyên thủy mật mã (Web Crypto API)
| Thuật toán | Mô tả |
|------------|-------|
| **PBKDF2-SHA256** | 310,000 vòng lặp + Salt ngẫu nhiên 16 bytes (đáp ứng OWASP 2023) |
| **AES-256-GCM** | Khóa 256 bits + IV ngẫu nhiên 12 bytes, đảm bảo tính bí mật và toàn vẹn |

#### Quản lý khóa trên RAM
Khóa mã hóa **chỉ tồn tại trong RAM** của tab trình duyệt. Bị xóa sạch (gán `null`) khi:
- Đóng tab hoặc tải lại trang (F5)
- Nhấn **Khóa két sắt** hoặc **Đăng xuất**
- Auto-Lock kích hoạt do không tương tác

#### Phân tích mô hình đe dọa
| Mối đe dọa | Biện pháp phòng vệ |
|-------------|---------------------|
| IPFS bị xâm nhập / Blockchain công khai | Dữ liệu hoàn toàn là ciphertext AES-256-GCM, không thể giải mã nếu không biết Master Password |
| Truy cập IndexedDB nội bộ | IndexedDB chỉ lưu bản ciphertext, không chứa plaintext |
| Tấn công brute-force | PBKDF2 310K vòng + Salt chống GPU/ASIC |
| Spam JIT Gas Faucet | Rate limit 3 lần/ngày/Google UID, chỉ cấp gas khi số dư < 0.001 ETH |
