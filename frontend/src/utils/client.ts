import { createPublicClient, http } from 'viem';
import { sepolia, hardhat } from 'viem/chains';

// Détecter l'environnement de développement
const isDev = process.env.NODE_ENV === 'development';

// Créer un client public Viem pour interagir avec la blockchain
export const publicClient = createPublicClient({
    chain: isDev ? hardhat : sepolia,
    transport: isDev
        ? http('http://localhost:8545')
        : http(process.env.RPC_URL),
});

// Client spécifique pour Hardhat (développement local)
export const hardhatClient = createPublicClient({
    chain: hardhat,
    transport: http('http://localhost:8545'),
});

// Client spécifique pour Sepolia (testnet)
export const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
});