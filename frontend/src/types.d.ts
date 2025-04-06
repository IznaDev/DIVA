// types.d.ts
// Ce fichier contient les déclarations de types globaux pour l'application

// Déclaration pour l'objet ethereum injecté par MetaMask
interface EthereumProvider {
  isMetaMask?: boolean;
  request?: (args: { method: string; params?: any[] }) => Promise<unknown>;
  on?: (eventName: string, callback: (...args: any[]) => void) => void;
  removeListener?: (eventName: string, callback: (...args: any[]) => void) => void;
  selectedAddress?: string;
  chainId?: string;
  // Ajoutez d'autres propriétés selon vos besoins
}

// Étendre l'interface Window globale
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: EthereumProvider;
  }
}
