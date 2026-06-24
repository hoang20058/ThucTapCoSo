import { ErrorCodes, VaultServiceError, normalizeError, validateCID } from "../utils/errorHandling";

export async function uploadToIPFS(encryptedData) {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) {
    throw new VaultServiceError(ErrorCodes.IPFS_UPLOAD_FAILED, "VITE_PINATA_JWT is not configured");
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({
        pinataOptions: { cidVersion: 1 },
        pinataMetadata: { name: "Web3PasswordVault.json" },
        pinataContent: encryptedData
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VaultServiceError(
        ErrorCodes.IPFS_UPLOAD_FAILED,
        `IPFS upload failed: ${response.status} ${response.statusText}`,
        errorText
      );
    }

    const result = await response.json();
    return validateCID(result.IpfsHash);
  } catch (error) {
    if (error instanceof VaultServiceError) throw error;
    throw normalizeError(error, ErrorCodes.IPFS_UPLOAD_FAILED);
  }
}

export async function fetchFromIPFS(cid) {
  const validCid = validateCID(cid);
  const gateway = import.meta.env.VITE_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
  const url = `${gateway.endsWith("/") ? gateway : `${gateway}/`}${validCid}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new VaultServiceError(
        ErrorCodes.IPFS_FETCH_FAILED,
        `IPFS fetch failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof VaultServiceError) throw error;
    throw normalizeError(error, ErrorCodes.IPFS_FETCH_FAILED);
  }
}
