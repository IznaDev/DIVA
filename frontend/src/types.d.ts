// types.d.ts
// Ce fichier contient les déclarations de types globaux pour l'application

// Types pour les paramètres et les callbacks
type JsonRpcParams = unknown[] | Record<string, unknown>;
type EthereumCallback = (...args: unknown[]) => void;

// Déclaration pour l'objet ethereum injecté par MetaMask
interface EthereumProvider {
  isMetaMask?: boolean;
  request?: (args: { method: string; params?: JsonRpcParams }) => Promise<unknown>;
  on?: (eventName: string, callback: EthereumCallback) => void;
  removeListener?: (eventName: string, callback: EthereumCallback) => void;
  selectedAddress?: string;
  chainId?: string;
  // Ajoutez d'autres propriétés selon vos besoins
}

// Étendre l'interface Window globale
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
