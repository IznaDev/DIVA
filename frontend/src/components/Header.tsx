import { ConnectButton } from "@rainbow-me/rainbowkit";


import PurchaseDivasButton from "./PurchaseDivasButton";

// Déclaration pour TypeScript - permet d'utiliser window.ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

const Header = () => {

    return (
        <div className="flex justify-between items-center p-5">
            <div className="grow flex items-center">
                <PurchaseDivasButton /> DIVA
            </div>
            <ConnectButton />
        </div>
    )
}

export default Header