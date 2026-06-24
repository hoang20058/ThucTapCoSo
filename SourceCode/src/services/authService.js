import { auth, googleProvider, signInWithPopup } from "../config/firebase";
import { signOut } from "firebase/auth";
import { ethers } from "ethers";
import { setActivePrivateKey } from "./blockchainService";

export async function loginWithGoogleService() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const uid = user.uid;
    const email = user.email || "";

    // Generate deterministic private key using ethers.id()
    const privateKey = ethers.id("dapp_secret_salt_" + uid + email);
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;

    // Cache private key in blockchain service RAM
    setActivePrivateKey(privateKey);

    return {
      success: true,
      uid,
      email,
      address,
      privateKey
    };
  } catch (error) {
    console.error("Google Auth popup error:", error);
    return {
      success: false,
      error: error.message || "Đăng nhập bằng Google bị hủy hoặc thất bại"
    };
  }
}

export async function signInWithGoogle() {
  const result = await loginWithGoogleService();
  if (!result.success) {
    throw new Error(result.error);
  }
  return {
    provider: "google",
    uid: result.uid,
    displayName: result.email.split("@")[0] || "Google User",
    email: result.email,
    photoURL: "https://placehold.co/96",
    address: result.address,
    privateKey: result.privateKey,
    accessMode: "firebase"
  };
}

export function restoreGooglePrivateKey(uid, email) {
  if (!uid) return;
  const privateKey = ethers.id("dapp_secret_salt_" + uid + email);
  setActivePrivateKey(privateKey);
}

export async function signOutGoogle() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out Google:", error);
  }
}

