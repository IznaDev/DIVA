'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, MOCK_USDC_ADDRESS, MOCK_USDC_ABI } from '@/constants';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, BaseError } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import Image from 'next/image';
import { ethers } from 'ethers';
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function PurchaseDivasButton() {
  // États pour gérer l'interface utilisateur
  const [amount, setAmount] = useState<string>('1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [showAddTokenDialog, setShowAddTokenDialog] = useState<boolean>(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));

  // Hook pour afficher des notifications toast
  const { toast } = useToast();

  // Hooks Wagmi pour interagir avec la blockchain
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Lire le solde USDC de l'utilisateur
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: !!address,
    }
  });

  // Mettre à jour le solde USDC
  useEffect(() => {
    if (balance) {
      setUsdcBalance(balance as bigint);
    }
  }, [balance]);
  
  // Réinitialiser les états lorsque l'utilisateur change de compte ou se déconnecte
  useEffect(() => {
    // Réinitialiser les états d'erreur et de succès
    setError(null);
    setSuccess(false);
    
    // Si l'utilisateur n'est pas connecté, fermer les boîtes de dialogue
    if (!isConnected) {
      setIsDialogOpen(false);
      setShowAddTokenDialog(false);
    }
  }, [address, isConnected]);

  // Vérifier les erreurs de transaction
  useEffect(() => {
    if (writeError) {
      console.error('Erreur de transaction:', writeError);
      const errorMessage = (writeError as BaseError).shortMessage || writeError.message || 'Transaction échouée';
      setError(`Erreur: ${errorMessage}`);
      setIsLoading(false);
    }
  }, [writeError]);

  // Écouter les événements TransferDivas
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;

    const watchTransferEvents = async () => {
      try {
        const unwatch = publicClient.watchContractEvent({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_CONTRACT_ABI,
          eventName: 'TransferDivas',
          onLogs: (logs) => {
            for (const log of logs) {
              // Typer correctement les args de l'événement
              type TransferDivasEvent = {
                args: {
                  to: string;
                  value: bigint;
                }
              };

              const typedLog = log as unknown as TransferDivasEvent;
              const { args } = typedLog;

              if (args && args.to === address) {
                // Formater l'adresse pour l'affichage
                const shortAddress = `${args.to.substring(0, 6)}...${args.to.substring(args.to.length - 4)}`;

                // Formater le montant
                const formattedAmount = formatEther(args.value);

                // Afficher une notification toast
                toast({
                  title: "Achat de Divas confirmé !",
                  description: (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>{`${shortAddress} a acheté ${formattedAmount} Divas`}</span>
                    </div>
                  ),
                  duration: 5000,
                  className: "bg-[#1A1927] border border-[#CF662D] text-white",
                });

                // Mettre à jour l'état de succès
                setSuccess(true);
                setIsLoading(false);

                // Rafraîchir le solde USDC
                refetchBalance();
              }
            }
          },
        });

        return unwatch;
      } catch (error) {
        console.error('Erreur event TransferDivas:', error);
        return () => { };
      }
    };

    const unwatchPromise = watchTransferEvents();

    return () => {
      unwatchPromise.then(unwatch => unwatch());
    };
  }, [isConnected, address, publicClient, toast, refetchBalance]);

  // Cette fonction génère une signature pour le permit EIP-2612
  const getSignature = async () => {
    if (!window.ethereum || !address) {
      throw new Error("Portefeuille non connecté");
    }

    try {
      // Créer un provider et un signer avec ethers.js
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Obtenir l'adresse du contrat Voting
      const votingAddress = VOTING_CONTRACT_ADDRESS;

      // Créer une instance du contrat MockUSDC pour obtenir le nonce
      const mockUsdcContract = new ethers.Contract(
        MOCK_USDC_ADDRESS,
        MOCK_USDC_ABI,
        provider
      );

      // Calculer la deadline (1 heure dans le futur)
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Obtenir le nonce actuel pour l'adresse de l'utilisateur
      const nonce = await mockUsdcContract.nonces(address);

      // Convertir le montant en wei
      const amountInWei = parseEther(amount);

      // Définir le domaine EIP-712
      const domain = {
        name: "MockUSDC",
        version: "1",
        chainId: (await provider.getNetwork()).chainId,
        verifyingContract: MOCK_USDC_ADDRESS
      };

      // Définir les types pour le message typé
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      // Définir les valeurs pour le message typé
      const value = {
        owner: address,
        spender: votingAddress,
        value: amountInWei.toString(),
        nonce: nonce.toString(),
        deadline: deadline
      };

      console.log('Signing permit with values:', value);

      // Signer le message typé
      const signature = await signer.signTypedData(domain, types, value);

      // Décomposer la signature
      const sig = ethers.Signature.from(signature);

      console.log('Signature générée:', {
        deadline,
        v: sig.v,
        r: sig.r,
        s: sig.s
      });

      return {
        deadline: BigInt(deadline),
        v: sig.v,
        r: sig.r,
        s: sig.s
      };
    } catch (error) {
      console.error('Erreur lors de la génération de la signature:', error);
      throw new Error(`Impossible de générer la signature: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour gérer l'achat de tokens DIVA
  const handlePurchase = async () => {
    if (!isConnected || !address) {
      setError('Veuillez connecter votre portefeuille');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      // Convertir le montant en wei (18 décimales)
      const amountInWei = parseEther(amount);
      console.log('Montant en wei:', amountInWei.toString());

      // Vérifier que l'utilisateur a suffisamment de USDC
      if (usdcBalance < amountInWei) {
        setError('Solde USDC insuffisant. Utilisez le faucet pour obtenir plus de tokens.');
        setIsLoading(false);
        return;
      }

      // Obtenir une signature valide pour le permit
      const { deadline, v, r, s } = await getSignature();

      // Afficher les informations de débogage
      console.log('Tentative d\'achat de tokens DIVA avec les paramètres suivants:');
      console.log('- Adresse de l\'acheteur:', address);
      console.log('- Montant:', amountInWei.toString());
      console.log('- Deadline:', deadline.toString());
      console.log('- Signature v:', v);
      console.log('- Signature r:', r);
      console.log('- Signature s:', s);

      // Appeler la fonction purchaseDivas du contrat
      const txHash = await writeContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_CONTRACT_ABI,
        functionName: 'purchaseDivas',
        args: [amountInWei, deadline, v, r, s],
      });

      console.log('Transaction envoyée, hash:', txHash);

      // Afficher une notification de transaction en cours
      toast({
        title: "Transaction en cours",
        description: (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#CF662D]" />
            <span>Achat de tokens DIVA en cours de traitement...</span>
          </div>
        ),
        style: { background: "#1A1927", border: "1px solid #CF662D", color: "white" },
        duration: 5000,
      });

      // Ne pas fermer la boîte de dialogue pour permettre à l'utilisateur de voir le message de succès
      // setIsDialogOpen(false);
    } catch (err) {
      console.error('Erreur lors de l\'achat de Divas:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : 'Transaction échouée'}`);
      setIsLoading(false);
      
      // Afficher une notification toast d'erreur
      toast({
        title: "Erreur de transaction",
        description: (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span>{err instanceof Error ? err.message : 'Transaction échouée'}</span>
          </div>
        ),
        style: { background: "#1A1927", border: "1px solid #CF662D", color: "white" },
        duration: 5000,
      });
    }
  };

  // Mettre à jour l'état de succès lorsque la transaction est confirmée
  useEffect(() => {
    if (isConfirmed && !success) {
      setSuccess(true);
      setIsLoading(false);
      console.log('Transaction confirmée, succès mis à jour');

      // Rafraîchir le solde USDC après confirmation
      refetchBalance();
      
      // Fermer la boîte de dialogue d'achat et ouvrir celle pour ajouter le token
      setIsDialogOpen(false);
      setShowAddTokenDialog(true);
    }
  }, [isConfirmed, success, refetchBalance]);

  // Fonction pour ajouter le token DIVA à MetaMask
  const addTokenToMetaMask = async () => {
    if (!window.ethereum) {
      setError("MetaMask n'est pas installé");
      return;
    }

    try {
      console.log('Tentative d\'ajout du token DIVA à MetaMask');

      // Utilisation de l'adresse réelle du token DIVA
      const divaTokenAddress = "0xCafac3dD18aC6c6e92c921884f9E4176737C052c";

      // Demander à MetaMask d'ajouter le token
      const success = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: divaTokenAddress,
            symbol: 'DIVA',
            decimals: 18,
            image: window.location.origin + '/images/diva_logo.png', // Image du token
          },
        },
      });

      console.log('Résultat de l\'ajout du token:', success);

      if (success) {
        toast({
          title: "Token ajouté",
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Le token DIVA a été ajouté à votre portefeuille MetaMask</span>
            </div>
          ),
          style: { background: "#1A1927", border: "1px solid #CF662D", color: "white" },
          duration: 5000,
        });
        
        // Fermer la boîte de dialogue d'ajout de token
        setShowAddTokenDialog(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du token à MetaMask:', error);
      setError('Impossible d\'ajouter le token à MetaMask');
      
      // Afficher une notification toast d'erreur
      toast({
        title: "Erreur",
        description: (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span>Impossible d'ajouter le token DIVA à MetaMask</span>
          </div>
        ),
        style: { background: "#1A1927", border: "1px solid #CF662D", color: "white" },
        duration: 5000,
      });
    }
  };

  return (
    <div className="relative">
      {/* Menu déroulant avec le logo DIVA */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto">
            <Image
              src="/images/diva_logo.png"
              alt="DIVA Logo"
              width={90}
              height={30}
              priority
              className="cursor-pointer"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="bg-[#1A1927] border border-[#CF662D] text-white">
          <DropdownMenuItem onSelect={() => setIsDialogOpen(true)} className="cursor-pointer hover:bg-[#CF662D]/20">
            Acheter des Divas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Boîte de dialogue pour l'achat de Divas */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1A1927] text-white border border-[#CF662D]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Acheter des tokens DIVA</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 p-4">
            {!isConnected && (
              <Alert variant="destructive">
                <AlertTitle>Attention</AlertTitle>
                <AlertDescription>
                  Veuillez connecter votre portefeuille pour acheter des Divas.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {address && balance !== null && balance !== undefined && (
              <div className="text-white mb-2">
                <p>Votre solde: <span className="font-bold">{formatEther(balance as bigint)} MockUSDC</span></p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium text-white">
                Montant de Divas à acheter
              </Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-gray-700 bg-[#1A1927]/50 text-white"
                disabled={isPending || isConfirming || isLoading}
              />
            </div>

            <Button
              onClick={handlePurchase}
              disabled={!isConnected || isPending || isConfirming || isLoading}
              className="w-full bg-[#CF662D] hover:bg-[#CF662D]/90 text-white font-bold"
            >
              {isPending || isConfirming || isLoading ? 'Transaction en cours...' : 'Confirmer l\'achat'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Boîte de dialogue pour ajouter le token DIVA à MetaMask */}
      <Dialog open={showAddTokenDialog} onOpenChange={setShowAddTokenDialog}>
        <DialogContent className="bg-[#1A1927] text-white border border-[#CF662D]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Achat réussi !</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 p-4">
            <div className="text-center mb-2">
              <p>Vous avez acheté {amount} Divas avec succès!</p>
            </div>
            
            <Button
              onClick={addTokenToMetaMask}
              className="w-full bg-[#CF662D] hover:bg-[#CF662D]/90 text-white font-bold"
            >
              Ajouter DIVA à MetaMask
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
