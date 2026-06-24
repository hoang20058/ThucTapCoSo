import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

function setOrReplaceEnvLine(existingText, key, value) {
  const lines = existingText.split(/\r?\n/);
  const prefix = `${key}=`;
  const nextLine = `${prefix}${value}`;
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (line.startsWith(prefix)) {
      replaced = true;
      return nextLine;
    }
    return line;
  });

  if (!replaced) {
    nextLines.push(nextLine);
  }

  return nextLines.join("\n").replace(/\n+$/, "\n");
}

export async function updateDeploymentEnv(contractAddress) {
  if (!contractAddress) {
    throw new Error("Contract address is required to update .env");
  }

  let current = "";
  try {
    current = await fs.readFile(envPath, "utf8");
  } catch {
    current = "";
  }

  const next = setOrReplaceEnvLine(current, "VITE_VAULT_CONTRACT_ADDRESS", contractAddress);
  await fs.writeFile(envPath, next, "utf8");
  console.log(`Updated .env with VITE_VAULT_CONTRACT_ADDRESS=${contractAddress}`);
}
