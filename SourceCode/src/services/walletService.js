import { BrowserProvider } from "ethers";

export async function connectMetaMask() {
  if (!window.ethereum) {
    return {
      provider: "metamask",
      address: "0x000000000000000000000000000000000000dEaD",
      chainId: 1,
      accessMode: "mock"
    };
  }

  const provider = new BrowserProvider(window.ethereum);
  await window.ethereum.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }]
  });
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider: "metamask",
    address,
    chainId: Number(network.chainId),
    accessMode: "wallet"
  };
}
