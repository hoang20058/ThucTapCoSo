import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const artifactsDir = path.join(projectRoot, "artifacts", "contracts");
const outputDir = path.join(projectRoot, "src", "contracts");

async function findArtifactPath(contractName) {
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(nextPath);
        if (found) return found;
        continue;
      }

      if (entry.isFile() && entry.name === `${contractName}.json`) {
        return nextPath;
      }
    }

    return null;
  }

  const foundPath = await walk(artifactsDir);
  if (foundPath) return foundPath;

  throw new Error(`Artifact for ${contractName} not found. Run hardhat compile first.`);
}

export async function exportContractAbi(contractName) {
  if (!contractName) {
    throw new Error("contractName is required");
  }

  const artifactPath = await findArtifactPath(contractName);
  const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
  const abiOnly = {
    contractName: artifact.contractName || contractName,
    sourceName: artifact.sourceName || "",
    abi: artifact.abi,
    bytecode: artifact.bytecode || "",
    deployedBytecode: artifact.deployedBytecode || ""
  };

  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${contractName}.abi.json`);
  await fs.writeFile(outputPath, JSON.stringify(abiOnly, null, 2), "utf8");
  console.log(`Exported ABI to ${path.relative(projectRoot, outputPath)}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const contractName = process.argv[2];
  exportContractAbi(contractName).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
