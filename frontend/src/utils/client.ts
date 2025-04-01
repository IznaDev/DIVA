import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// Créer un client public Viem pour interagir avec la blockchain
export const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
});