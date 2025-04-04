'use client';
import '@rainbow-me/rainbowkit/styles.css';
import {
    getDefaultConfig,
    RainbowKitProvider,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
    hardhat,
    sepolia
} from 'wagmi/chains';
import {
    QueryClientProvider,
    QueryClient,
} from "@tanstack/react-query";
import { http } from 'viem';
import { PostProvider } from '@/context/PostContext';

const config = getDefaultConfig({
    appName: 'DIVA',
    projectId: 'YOUR_PROJECT_ID',
    chains: [hardhat, sepolia],
    transports: {
        [hardhat.id]: http('http://localhost:8545'),
        [sepolia.id]: http(process.env.RPC_URL || 'https://sepolia.infura.io/v3/d28acd12e3f44180b491a06a415f3c17')
    },
    ssr: true, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

const CustomProvider = ({ children }: Readonly<{
    children: React.ReactNode;
}>) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme({
                    accentColor: '#CF662D',
                    accentColorForeground: 'white',
                    borderRadius: 'medium',
                    fontStack: 'system'
                })}>
                    <PostProvider>
                        {children}
                    </PostProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default CustomProvider;
