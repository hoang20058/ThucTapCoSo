import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import {
  adjacencyGraphs,
  dictionary
} from "@zxcvbn-ts/language-common";

const MIN_PASSWORD_LENGTH = 8;
const SAFE_SCORE_THRESHOLD = 3;

const COMMON_PASSWORDS = new Set([
  "123456",
  "123456789",
  "12345678",
  "12345",
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "abc123",
  "111111",
  "000000",
  "123123",
  "iloveyou",
  "admin",
  "welcome",
  "letmein",
  "monkey",
  "dragon",
  "sunshine",
  "football",
  "baseball",
  "master",
  "login",
  "passw0rd",
  "1q2w3e4r",
  "1qaz2wsx",
  "zaq12wsx",
  "asdfgh",
  "asdf1234",
  "987654321",
  "11111111",
  "1234",
  "1234567",
  "654321",
  "7777777",
  "123321",
  "qwe123",
  "princess",
  "charlie",
  "myspace1",
  "freedom",
  "superman",
  "trustno1",
  "admin123",
  "root",
  "pass123",
  "123456a",
  "0987654321",
  "batman",
  "hello123"
]);

let strengthEngineConfigured = false;

function ensureStrengthEngine() {
  if (strengthEngineConfigured) return;

  zxcvbnOptions.setOptions({
    dictionary: {
      ...dictionary,
      userInputs: []
    },
    graphs: adjacencyGraphs
  });

  strengthEngineConfigured = true;
}

function getStrengthLabel(score) {
  if (score <= 1) return "Yếu";
  if (score === 2) return "Trung bình";
  if (score === 3) return "Khá";
  return "Mạnh";
}

function translateCrackTimeDisplay(value) {
  if (!value) return "";

  return String(value)
    .replace(/years?/gi, "năm")
    .replace(/months?/gi, "tháng")
    .replace(/weeks?/gi, "tuần")
    .replace(/days?/gi, "ngày")
    .replace(/hours?/gi, "giờ")
    .replace(/minutes?/gi, "phút")
    .replace(/seconds?/gi, "giây")
    .replace(/less than/gi, "ít hơn")
    .replace(/centuries?/gi, "Thế kỷ");
}

export function extractUserInputs(profile) {
  if (!profile) return [];
  const { fullName, dob, phone } = profile;
  const inputs = new Set();

  // 1. fullName: Bỏ dấu tiếng Việt, in thường, tách nhỏ từng từ
  if (fullName && typeof fullName === "string" && fullName.trim()) {
    const removeDiacritics = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    
    const cleanName = removeDiacritics(fullName).toLowerCase();
    const words = cleanName.split(/\s+/).filter(Boolean);
    words.forEach(w => inputs.add(w));
    
    // Thêm các từ gốc in thường
    const originalWords = fullName.toLowerCase().split(/\s+/).filter(Boolean);
    originalWords.forEach(w => inputs.add(w));
  }

  // 2. dob: YYYY-MM-DD -> [YYYY, MM, DD, DDMMYYYY, YYYYMMDD, DDMM]
  if (dob && typeof dob === "string" && dob.trim()) {
    const parts = dob.split("-"); // [YYYY, MM, DD]
    if (parts.length === 3) {
      const [year, month, day] = parts;
      inputs.add(year);
      inputs.add(month);
      inputs.add(day);
      inputs.add(day + month + year); // "15082005"
      inputs.add(year + month + day); // "20050815"
      inputs.add(day + month);        // "1508"
      inputs.add(month + day);        // "0815"
    }
  }

  // 3. phone: Lấy toàn bộ chuỗi số và 4-6 số cuối
  if (phone && typeof phone === "string" && phone.trim()) {
    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone) {
      inputs.add(cleanedPhone);
      if (cleanedPhone.length >= 4) {
        inputs.add(cleanedPhone.slice(-4));
      }
      if (cleanedPhone.length >= 5) {
        inputs.add(cleanedPhone.slice(-5));
      }
      if (cleanedPhone.length >= 6) {
        inputs.add(cleanedPhone.slice(-6));
      }
    }
  }

  return Array.from(inputs).filter(item => typeof item === "string" && item.length >= 2);
}

export function containsPersonalInfo(password, userInputs) {
  if (!password || !userInputs || userInputs.length === 0) return false;
  const lowerPassword = String(password).toLowerCase();
  return userInputs.some((input) => {
    if (typeof input !== "string") return false;
    const lowerInput = input.trim().toLowerCase();
    return lowerInput.length >= 2 && lowerPassword.includes(lowerInput);
  });
}

export function evaluatePasswordStrength(password = "", userInputs = [], personalInputs = []) {
  const normalizedPassword = String(password ?? "");
  const loweredPassword = normalizedPassword.toLowerCase();
  const cleanedInputs = userInputs
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());

  if (!normalizedPassword) {
    return {
      score: 0,
      label: "Rỗng",
      isCommon: false,
      tooShort: true,
      meetsPolicy: false,
      warning: "",
      suggestions: [],
      crackTimeDisplay: ""
    };
  }

  ensureStrengthEngine();
  const result = zxcvbn(normalizedPassword, cleanedInputs);
  const isCommon = COMMON_PASSWORDS.has(loweredPassword);
  const hasPersonalInfo = containsPersonalInfo(normalizedPassword, personalInputs);
  const tooShort = normalizedPassword.length < MIN_PASSWORD_LENGTH;
  const score = isCommon || hasPersonalInfo ? 0 : result.score;
  
  const warning = hasPersonalInfo
    ? "Mật khẩu chứa thông tin cá nhân của bạn (Tên/Ngày sinh/SĐT), vui lòng chọn mật khẩu khác!"
    : isCommon
    ? "Mật khẩu nằm trong danh sách phổ biến, rất dễ bị tấn công."
    : result.feedback.warning || "";

  const suggestions = hasPersonalInfo
    ? [
        "Không dùng thông tin cá nhân (tên, ngày sinh, số điện thoại) trong mật khẩu của bạn.",
        "Chọn một mật khẩu hoàn toàn khác biệt và ngẫu nhiên."
      ]
    : isCommon
    ? [
        "Không dùng mật khẩu phổ biến hoặc mang tính mặc định.",
        "Tăng độ dài và kết hợp chữ hoa, chữ thường, số, ký tự đặc biệt."
      ]
    : result.feedback.suggestions || [];

  const meetsPolicy = !tooShort && score >= SAFE_SCORE_THRESHOLD && !hasPersonalInfo;

  return {
    score,
    label: getStrengthLabel(score),
    isCommon,
    tooShort,
    meetsPolicy,
    warning,
    suggestions,
    crackTimeDisplay: translateCrackTimeDisplay(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond || "")
  };
}


export const isSafePassword = (password = "", userInputs = [], personalInputs = []) =>
  evaluatePasswordStrength(password, userInputs, personalInputs).meetsPolicy;

export function assessVaultPasswords(vaults = []) {
  const entries = Array.isArray(vaults) ? vaults : [];
  const weakEntries = entries
    .map((item, index) => ({
      index,
      url: item?.url || "",
      username: item?.username || "",
      strength: evaluatePasswordStrength(item?.password || "", [item?.url || "", item?.username || ""])
    }))
    .filter((item) => !item.strength.meetsPolicy);

  return {
    total: entries.length,
    weakCount: weakEntries.length,
    safeCount: entries.length - weakEntries.length,
    weakEntries
  };
}

export const getDomainName = (url = "") => {
  try {
    return url.replace(/^(https?:\/\/)?(www\.)?/i, "").split("/")[0];
  } catch {
    return "unknown-site";
  }
};
