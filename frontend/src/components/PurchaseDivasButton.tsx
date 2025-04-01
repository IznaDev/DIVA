'use client';

import { useState, useEffect } from 'react';
import { VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, MOCK_USDC_ADDRESS, MOCK_USDC_ABI, DIVA_TOKEN_ADDRESS, DIVA_TOKEN_ABI, POST_MANAGER_ADDRESS, POST_MANAGER_ABI } from '@/constants';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, BaseError } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import Image from 'next/image';
import { ethers } from 'ethers';
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { publicClient as viemClient } from "@/utils/client";

export default function PurchaseDivasButton() {
  // États pour gérer l'interface utilisateur
  const [amount, setAmount] = useState<string>('1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);

  // États pour le formulaire de création de post
  const [postTitle, setPostTitle] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [isPostingInProgress, setIsPostingInProgress] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Hook pour afficher des notifications toast
  const { toast } = useToast();

  // Hooks Wagmi pour interagir avec la blockchain
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();

  // Séparer les hooks pour les différentes transactions
  const { writeContract, data: purchaseHash, error: purchaseError, isPending: isPurchasePending } = useWriteContract();
  const { isLoading: isPurchaseConfirming, isSuccess: isPurchaseConfirmed } =
    useWaitForTransactionReceipt({
      hash: purchaseHash,
    });

  // Hook spécifique pour la création de post
  const { writeContract: writePostContract, data: postHash, error: postingError, isPending: isPostPending } = useWriteContract();
  const { isLoading: isPostConfirming, isSuccess: isPostConfirmed } =
    useWaitForTransactionReceipt({
      hash: postHash,
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
      setIsCreatePostDialogOpen(false);
    }
  }, [address, isConnected]);

  //ajout d'un état pour suivre les transactions déjà traitées
  const [processedTransactions, setProcessedTransactions] = useState<string[]>(() => {
    // Récupérer les transactions déjà traitées du stockage local
    const savedTransactions = localStorage.getItem('processedDivaTransactions');
    return savedTransactions ? JSON.parse(savedTransactions) : [];
  });

  // Sauvegarder les transactions traitées dans le stockage local
  useEffect(() => {
    localStorage.setItem('processedDivaTransactions', JSON.stringify(processedTransactions));
  }, [processedTransactions]);

  // Écouter les événements TransferDivas
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;

    // Ne pas démarrer l'écoute des événements si aucune transaction n'est en cours
    if (!isPurchasePending && !isPurchaseConfirming) return;

    let lastCheckedBlock: bigint;
    let intervalId: NodeJS.Timeout;
    let isInitialCheck = true;

    const checkForNewEvents = async () => {
      try {
        // Obtenir le numéro du bloc actuel
        const currentBlock = await viemClient.getBlockNumber();

        // Si c'est la première vérification, initialiser lastCheckedBlock
        if (!lastCheckedBlock) {
          lastCheckedBlock = currentBlock;
          return;
        }

        // Si c'est la vérification initiale après changement de compte, ne pas traiter les événements
        if (isInitialCheck) {
          isInitialCheck = false;
          lastCheckedBlock = currentBlock;
          return;
        }

        // Récupérer les logs pour l'événement TransferDivas depuis le dernier bloc vérifié
        const logs = await viemClient.getLogs({
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          event: (VOTING_CONTRACT_ABI as any).find((x: any) => x.name === 'TransferDivas' && x.type === 'event'),
          fromBlock: lastCheckedBlock,
          toBlock: currentBlock,
        });

        // Mettre à jour le dernier bloc vérifié
        lastCheckedBlock = currentBlock;

        // Traiter chaque log
        for (const log of logs) {
          // Vérifier si cette transaction a déjà été traitée
          if (!log.transactionHash) continue;

          const txHash = log.transactionHash as string;

          if (processedTransactions.includes(txHash)) {
            console.log('Transaction déjà traitée, ignorée:', txHash);
            continue;
          }

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
            console.log('Nouvelle transaction TransferDivas détectée:', txHash);

            // Ajouter cette transaction à la liste des transactions traitées
            setProcessedTransactions(prev => {
              const newProcessedTx = [...prev, txHash];
              // Limiter le nombre de transactions stockées pour éviter de surcharger le stockage local
              if (newProcessedTx.length > 100) {
                return newProcessedTx.slice(-100);
              }
              return newProcessedTx;
            });

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

            // Arrêter l'intervalle une fois que nous avons trouvé notre transaction
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des événements TransferDivas:', error);
      }
    };

    // Initialiser la vérification des événements
    const initEventChecking = async () => {
      // Initialiser lastCheckedBlock avec le bloc actuel
      lastCheckedBlock = await viemClient.getBlockNumber();

      // Vérifier les événements toutes les 5 secondes pendant la transaction
      intervalId = setInterval(checkForNewEvents, 5000);
    };

    initEventChecking();

    // Nettoyer l'intervalle lors du démontage du composant ou lorsque la transaction est terminée
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, address, publicClient, refetchBalance, processedTransactions, isPurchasePending, isPurchaseConfirming]);

  // Écouter les événements PostCreated uniquement pendant la création d'un post
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;

    // Ne démarrer l'écoute que si nous sommes en train de poster
    if (!isPostingInProgress && !isPostConfirming) return;

    let lastCheckedBlock: bigint;
    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const checkForNewPostEvents = async () => {
      try {
        // Obtenir le numéro du bloc actuel
        const currentBlock = await viemClient.getBlockNumber();

        // Si c'est la première vérification, initialiser lastCheckedBlock
        if (!lastCheckedBlock) {
          lastCheckedBlock = currentBlock;
          return;
        }

        // Récupérer les logs pour l'événement PostCreated depuis le dernier bloc vérifié
        const logs = await viemClient.getLogs({
          address: POST_MANAGER_ADDRESS as `0x${string}`,
          event: (POST_MANAGER_ABI as any).find((x: any) => x.name === 'PostCreated' && x.type === 'event'),
          fromBlock: lastCheckedBlock,
          toBlock: currentBlock,
        });

        // Mettre à jour le dernier bloc vérifié
        lastCheckedBlock = currentBlock;

        // Traiter chaque log
        for (const log of logs) {
          // Typer correctement les args de l'événement
          type PostCreatedEvent = {
            args: {
              poster: string;
              contentUrl: string;
            }
          };

          const typedLog = log as unknown as PostCreatedEvent;
          const { args } = typedLog;

          // Vérifier si c'est notre post en comparant l'URL
          if (args && args.contentUrl === postUrl) {
            console.log('Post détecté avec notre URL:', args.contentUrl);

            // Afficher une notification de succès
            toast({
              title: "Publication réussie",
              description: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Votre post a été publié avec succès!</span>
                </div>
              ),
              className: "bg-[#1A1927] border border-[#CF662D] text-white",
              duration: 5000,
            });

            // Réinitialiser les champs et fermer la boîte de dialogue
            setPostTitle('');
            setPostUrl('');
            setIsCreatePostDialogOpen(false);
            setIsPostingInProgress(false);

            // Nettoyer les timers
            if (intervalId) clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);

            return; // Sortir de la fonction après avoir trouvé notre post
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des événements PostCreated:', error);
      }
    };

    // Initialiser la vérification des événements
    const initEventChecking = async () => {
      // Initialiser lastCheckedBlock avec le bloc actuel
      lastCheckedBlock = await viemClient.getBlockNumber();

      // Vérifier les événements toutes les 3 secondes pendant la création du post
      intervalId = setInterval(checkForNewPostEvents, 3000);

      // Mettre en place un timeout de sécurité pour arrêter l'écoute après 30 secondes
      timeoutId = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);

        // Si nous sommes toujours en train de poster après 30 secondes, fermer la boîte de dialogue
        if (isPostingInProgress) {
          toast({
            title: "Information",
            description: (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[#CF662D]" />
                <span>La transaction a été envoyée mais nous n'avons pas pu confirmer sa finalisation. Vérifiez votre historique de transactions.</span>
              </div>
            ),
            className: "bg-[#1A1927] border border-[#CF662D] text-white",
            duration: 8000,
          });

          setIsCreatePostDialogOpen(false);
          setIsPostingInProgress(false);
        }
      }, 30000);
    };

    initEventChecking();

    // Nettoyer les intervalles et timeouts lors du démontage du composant
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isConnected, address, publicClient, postUrl, isPostingInProgress, isPostConfirming]);

  // Mettre à jour l'état de succès lorsque la transaction d'achat est confirmée via useWaitForTransactionReceipt
  useEffect(() => {
    if (isPurchaseConfirmed && !success) {
      setSuccess(true);
      setIsLoading(false);
      console.log('Transaction d\'achat confirmée via useWaitForTransactionReceipt');

      // Rafraîchir le solde USDC après confirmation
      refetchBalance();

      // Afficher une notification de succès
      toast({
        title: "Achat confirmé",
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Votre achat de tokens DIVA a été confirmé!</span>
          </div>
        ),
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });

      // Ajouter le token DIVA à MetaMask uniquement après confirmation d'achat
      addTokenToMetaMask();
    }
  }, [isPurchaseConfirmed, success, refetchBalance]);

  // Gérer la confirmation de la transaction de post via useWaitForTransactionReceipt
  useEffect(() => {
    if (isPostConfirmed && isPostingInProgress) {
      console.log('Transaction de post confirmée via useWaitForTransactionReceipt');

      // Vérifier si l'événement a déjà été capturé (si la boîte de dialogue est déjà fermée)
      if (isCreatePostDialogOpen) {
        // Si l'événement n'a pas été capturé, fermer manuellement la boîte de dialogue
        setTimeout(() => {
          if (isCreatePostDialogOpen && isPostingInProgress) {
            toast({
              title: "Publication confirmée",
              description: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Votre post a été publié avec succès!</span>
                </div>
              ),
              className: "bg-[#1A1927] border border-[#CF662D] text-white",
              duration: 5000,
            });

            setPostTitle('');
            setPostUrl('');
            setIsCreatePostDialogOpen(false);
            setIsPostingInProgress(false);
          }
        }, 3000); // Attendre 3 secondes pour laisser le temps à l'écouteur d'événements de traiter l'événement
      }
    }
  }, [isPostConfirmed, isPostingInProgress, isCreatePostDialogOpen]);

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

  // Fonction pour obtenir une signature pour le token DIVA (pour la création de post)
  const getDivaSignature = async () => {
    if (!window.ethereum || !address) {
      throw new Error("Portefeuille non connecté");
    }

    try {
      // Créer un provider et un signer avec ethers.js
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Obtenir l'adresse du contrat Voting
      const votingAddress = VOTING_CONTRACT_ADDRESS;

      // Utiliser l'adresse du token DIVA depuis les constantes
      const divaTokenAddress = DIVA_TOKEN_ADDRESS;

      // Créer une instance du contrat DivaToken avec l'ABI complet
      const divaTokenContract = new ethers.Contract(
        divaTokenAddress,
        DIVA_TOKEN_ABI,
        provider
      );

      // Calculer la deadline (1 heure dans le futur)
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Obtenir le nonce actuel pour l'adresse de l'utilisateur
      const nonce = await divaTokenContract.nonces(address);

      // Montant fixe pour la création de post (5 DIVA)
      const postStakeAmount = parseEther("5");

      // Obtenir le nom du token pour le domaine EIP-712
      const tokenName = await divaTokenContract.name();

      // Définir le domaine EIP-712
      const domain = {
        name: tokenName,
        version: "1",
        chainId: (await provider.getNetwork()).chainId,
        verifyingContract: divaTokenAddress
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
        value: postStakeAmount.toString(),
        nonce: nonce.toString(),
        deadline: deadline
      };

      console.log('Signing DIVA permit with values:', value);

      // Signer le message typé
      const signature = await signer.signTypedData(domain, types, value);

      // Décomposer la signature
      const sig = ethers.Signature.from(signature);

      console.log('DIVA Signature générée:', {
        deadline,
        v: sig.v,
        r: sig.r,
        s: sig.s
      });

      return {
        deadline: BigInt(deadline),
        v: sig.v,
        r: sig.r,
        s: sig.s,
        amount: postStakeAmount
      };
    } catch (error) {
      console.error('Erreur lors de la génération de la signature DIVA:', error);
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
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });

      // Ne pas fermer la boîte de dialogue pour permettre à l'utilisateur de voir le message de succès
      // setIsDialogOpen(false);
    } catch (err) {
      console.error('Erreur lors de l\'achat de Divas:', err);
      setError(`Erreur: ${(err as BaseError).shortMessage || (err as Error).message || 'Transaction échouée'}`);
      setIsLoading(false);

      // Afficher une notification toast d'erreur
      toast({
        title: "Erreur de transaction",
        description: (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span>{(err as BaseError).shortMessage || (err as Error).message || 'Transaction échouée'}</span>
          </div>
        ),
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });
    }
  };

  // Fonction pour gérer la soumission du post
  const handlePostSubmit = async () => {
    // Réinitialiser les erreurs
    setPostError(null);

    // Vérifier que le titre et l'URL sont renseignés
    if (!postTitle || !postUrl) {
      setPostError('Veuillez remplir tous les champs');
      return;
    }

    // Vérifier si l'URL est valide
    try {
      new URL(postUrl);
    } catch (e) {
      setPostError('Veuillez entrer une URL valide');
      return;
    }

    // Vérifier si l'utilisateur est connecté
    if (!isConnected || !address) {
      setPostError('Veuillez connecter votre portefeuille');
      return;
    }

    try {
      // Indiquer que la publication est en cours
      setIsPostingInProgress(true);

      // Afficher une notification toast pour indiquer que le post est en cours de traitement
      toast({
        title: "Publication en cours",
        description: (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#CF662D]" />
            <span>Votre post est en cours de publication...</span>
          </div>
        ),
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });

      // Obtenir une signature valide pour le permit du token DIVA
      const { deadline, v, r, s, amount } = await getDivaSignature();

      // Afficher les informations de débogage
      console.log('Tentative de création de post avec les paramètres suivants:');
      console.log('- Adresse du créateur:', address);
      console.log('- URL du contenu:', postUrl);
      console.log('- Montant de stake:', amount.toString());
      console.log('- Deadline:', deadline.toString());
      console.log('- Signature v:', v);
      console.log('- Signature r:', r);
      console.log('- Signature s:', s);

      // Appeler la fonction createPost du contrat Voting avec le hook spécifique
      const txHash = await writePostContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_CONTRACT_ABI,
        functionName: 'createPost',
        args: [postUrl, amount, deadline, v, r, s],
      });

      console.log('Transaction de création de post envoyée, hash:', txHash);

      // La fermeture de la boîte de dialogue et l'affichage de la notification de succès
      // seront gérés par l'écouteur d'événements PostCreated
    } catch (err) {
      console.error('Erreur lors de la création du post:', err);
      setPostError(`Erreur: ${(err as BaseError).shortMessage || (err as Error).message || 'Transaction échouée'}`);
      setIsPostingInProgress(false);

      // Afficher une notification toast d'erreur
      toast({
        title: "Erreur de publication",
        description: (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span>{(err as BaseError).shortMessage || (err as Error).message || 'Transaction échouée'}</span>
          </div>
        ),
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });
    }
  };

  // Fonction pour ajouter le token DIVA à MetaMask
  const addTokenToMetaMask = async () => {
    if (!window.ethereum) {
      console.log("MetaMask n'est pas installé");
      return;
    }

    try {
      console.log('Ajout automatique du token DIVA à MetaMask');

      // Utilisation de l'adresse réelle du token DIVA
      const divaTokenAddress = DIVA_TOKEN_ADDRESS;

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
        setIsDialogOpen(false);
        toast({
          title: "Token DIVA ajouté",
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Le token DIVA a été ajouté à votre portefeuille MetaMask</span>
            </div>
          ),
          className: "bg-[#1A1927] border border-[#CF662D] text-white",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du token à MetaMask:', error);
      // Ne pas afficher d'erreur à l'utilisateur, car c'est une fonctionnalité supplémentaire
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
        <DropdownMenuContent align="center" className="bg-[#1A1927] text-white border border-[#CF662D]">
          <DropdownMenuItem onSelect={() => setIsDialogOpen(true)} className="cursor-pointer hover:bg-[#CF662D]/20">
            Acheter des Divas
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIsCreatePostDialogOpen(true)} className="cursor-pointer hover:bg-[#CF662D]/20">
            Créer ton Post
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
                disabled={isPurchasePending || isLoading}
              />
            </div>

            <Button
              onClick={handlePurchase}
              disabled={!isConnected || isPurchasePending || isLoading}
              className="w-full bg-[#CF662D] hover:bg-[#CF662D]/90 text-white font-bold"
            >
              {isPurchasePending || isLoading ? 'Transaction en cours...' : 'Confirmer l\'achat'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Boîte de dialogue pour la création de post */}
      <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
        <DialogContent className="bg-[#1A1927] text-white border border-[#CF662D]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Créer un nouveau post</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 p-4">
            {!isConnected && (
              <Alert variant="destructive">
                <AlertTitle>Attention</AlertTitle>
                <AlertDescription>
                  Veuillez connecter votre portefeuille pour créer un post.
                </AlertDescription>
              </Alert>
            )}

            {postError && (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{postError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="postTitle" className="text-sm font-medium text-white">
                Titre du post
              </Label>
              <Input
                id="postTitle"
                type="text"
                placeholder="Entrez un titre descriptif court"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="border-gray-700 bg-[#1A1927]/50 text-white"
                disabled={!isConnected || isPostingInProgress}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postUrl" className="text-sm font-medium text-white">
                URL du contenu
              </Label>
              <Input
                id="postUrl"
                type="url"
                placeholder="https://exemple.com/votre-contenu"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                className="border-gray-700 bg-[#1A1927]/50 text-white"
                disabled={!isConnected || isPostingInProgress}
              />
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => setIsCreatePostDialogOpen(false)}
                className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white font-bold"
                disabled={isPostingInProgress}
              >
                Annuler
              </Button>
              <Button
                onClick={handlePostSubmit}
                disabled={!isConnected || isPostingInProgress}
                className="w-1/2 bg-[#CF662D] hover:bg-[#CF662D]/90 text-white font-bold"
              >
                {isPostingInProgress ? 'Publication...' : 'Poster'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}