'use client';

import { Button } from "./ui/button";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ExternalLink, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseAbiItem, parseEther } from 'viem';
import { ethers } from 'ethers';
import { VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, DIVA_TOKEN_ADDRESS, DIVA_TOKEN_ABI, POST_MANAGER_ADDRESS, POST_MANAGER_ABI } from '@/constants';
import { useToast } from "@/hooks/use-toast";
import { publicClient as viemClient, hardhatClient } from "@/utils/client";

interface PostCardProps {
  id: string;
  url: string;
  poster: string;
  timestamp: number;
}

export default function PostCard({ id, url, poster, timestamp }: PostCardProps) {
  // États pour gérer le vote
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [voteChoice, setVoteChoice] = useState<number | null>(null); // 1 pour VRAI, 2 pour FAKE
  const [voteHash, setVoteHash] = useState<string | null>(null);
  const [isVoteConfirmed, setIsVoteConfirmed] = useState<boolean>(false);
  // Nouveaux états pour les résultats du vote
  const [voteResult, setVoteResult] = useState<number | null>(null); // 0 pour None, 1 pour True, 2 pour False
  const [voteMajority, setVoteMajority] = useState<number | null>(null);
  const [isVoteFinalized, setIsVoteFinalized] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Hooks Wagmi
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  // Hooks pour écrire dans le contrat et attendre la confirmation
  const { writeContract: writeVoteContract, data: voteData } = useWriteContract();
  const { isSuccess: isVoteSuccess } = useWaitForTransactionReceipt({
    hash: voteData,
  });

  // Vérifier si l'utilisateur actuel a déjà voté sur ce post
  useEffect(() => {
    const checkIfUserHasVoted = async () => {
      if (!isConnected || !address || !publicClient) {
        setHasVoted(false);
        setVoteChoice(null);
        return;
      }

      try {
        console.log(`Vérification si l'utilisateur ${address} a déjà voté sur le post ${id}`);

        // Appel au contrat PostManager pour vérifier si l'utilisateur a déjà voté
        const voteData = await publicClient.readContract({
          address: POST_MANAGER_ADDRESS as `0x${string}`,
          abi: POST_MANAGER_ABI,
          functionName: 'getVote',
          args: [BigInt(id), address]
        });

        console.log('Information de vote récupérée:', voteData);

        // voteData est un tableau avec [choice, stakeAmount, timestamp, withdrawn]
        if (voteData && Array.isArray(voteData)) {
          const choice = Number(voteData[0]);
          // VoteOption.None = 0, VoteOption.True = 1, VoteOption.False = 2
          if (choice !== 0) {
            setHasVoted(true);
            setVoteChoice(choice);
            console.log(`L'utilisateur a déjà voté: ${choice === 1 ? 'VRAI' : 'FAKE'}`);
          } else {
            setHasVoted(false);
            setVoteChoice(null);
            console.log("L'utilisateur n'a pas encore voté sur ce post");
          }
        } else {
          setHasVoted(false);
          setVoteChoice(null);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du vote:', error);
        setHasVoted(false);
        setVoteChoice(null);
      }
    };

    checkIfUserHasVoted();
  }, [id, address, isConnected, publicClient]);

  // Mettre à jour l'état quand la transaction est confirmée
  useEffect(() => {
    if (isVoteSuccess && voteData) {
      setIsVoteConfirmed(true);
      setVoteHash(voteData);
    }
  }, [isVoteSuccess, voteData]);

  // Écouter l'événement VoteCast après confirmation de la transaction
  useEffect(() => {
    if (isVoteConfirmed && isVoting && voteHash) {
      console.log('Transaction de vote confirmée, recherche de l\'événement VoteCast');
      listenForVoteCastEvent(voteHash);
    }
  }, [isVoteConfirmed, isVoting, voteHash]);

  // Vérifier si le vote a été finalisé au chargement du composant
  useEffect(() => {
    const checkIfVoteFinalized = async () => {
      if (!publicClient) return;

      try {
        console.log(`Vérification si le vote est finalisé pour le post ${id}`);

        // Rechercher les événements VoteFinalized pour ce post
        const logs = await publicClient.getLogs({
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          event: parseAbiItem('event VoteFinalized(uint256 indexed postId, uint8 result, uint256 majority, uint256 totalRewarded, uint256 totalReturned, uint256 winnerCount, uint256 loserCount)'),
          args: {
            postId: BigInt(id)
          },
          fromBlock: BigInt(0),
          toBlock: 'latest'
        });

        console.log('Logs d\'événements VoteFinalized trouvés:', logs);

        if (logs.length > 0) {
          // Récupérer les résultats du vote
          const result = Number(logs[0].args.result);
          const majority = Number(logs[0].args.majority);

          console.log('Résultat du vote:', result === 1 ? 'VRAI' : result === 2 ? 'FAKE' : 'INDÉTERMINÉ');
          console.log('Majorité:', majority, '%');

          // Mettre à jour les états
          setVoteResult(result);
          setVoteMajority(majority);
          setIsVoteFinalized(true);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des événements VoteFinalized:', error);
      }
    };

    checkIfVoteFinalized();
  }, [id, publicClient]);

  // Fonction pour obtenir une signature pour le permit du token DIVA (pour le vote)
  const getDivaSignatureForVote = async (amount: string = "0.1") => {
    if (!window.ethereum || !address) {
      throw new Error("Portefeuille non connecté");
    }

    try {
      // Créer un provider et un signer avec ethers.js
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Obtenir l'adresse du contrat Voting
      const votingAddress = VOTING_CONTRACT_ADDRESS;

      // Créer une instance du contrat DIVA pour obtenir le nonce
      const divaContract = new ethers.Contract(
        DIVA_TOKEN_ADDRESS,
        DIVA_TOKEN_ABI,
        provider
      );

      // Calculer la deadline (1 an dans le futur au lieu de 1 heure)
      // Cela permet d'éviter les problèmes lorsque le temps est avancé pour finaliser un vote
      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 365 jours

      // Obtenir le nonce actuel pour l'adresse de l'utilisateur
      const nonce = await divaContract.nonces(address);

      // Convertir le montant en wei (0.1 DIVA par défaut)
      const amountInWei = parseEther(amount);

      // Obtenir le nom du token pour le domaine EIP-712
      const tokenName = await divaContract.name();
      console.log('Nom du token DIVA récupéré:', tokenName);

      // Définir le domaine EIP-712
      const domain = {
        name: tokenName,
        version: "1",
        chainId: Number((await provider.getNetwork()).chainId),
        verifyingContract: DIVA_TOKEN_ADDRESS
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

      console.log('Signing DIVA permit for vote with values:', value);

      // Signer le message typé
      const signature = await signer.signTypedData(domain, types, value);

      // Décomposer la signature
      const sig = ethers.Signature.from(signature);

      console.log('Signature générée pour le vote:', {
        deadline,
        v: sig.v,
        r: sig.r,
        s: sig.s
      });

      return {
        amount: amountInWei,
        deadline: BigInt(deadline),
        v: sig.v,
        r: sig.r,
        s: sig.s
      };
    } catch (error) {
      console.error('Erreur lors de la génération de la signature pour le vote:', error);
      throw new Error(`Impossible de générer la signature: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour écouter l'événement VoteCast
  const listenForVoteCastEvent = async (transactionHash?: string) => {
    if (!isConnected || !address || !publicClient) return;

    console.log('Démarrage de l\'écoute des événements VoteCast');

    // Déterminer quel client utiliser en fonction de l'environnement
    const isDev = process.env.NODE_ENV === 'development';
    console.log('Environnement de développement:', isDev ? 'Oui' : 'Non');
    console.log('Client utilisé:', isDev ? 'hardhatClient' : 'viemClient');

    try {
      if (transactionHash) {
        console.log(`Récupération des logs pour la transaction spécifique: ${transactionHash}`);

        // Attendre que la transaction soit confirmée
        const receipt = await (isDev ? hardhatClient : viemClient).waitForTransactionReceipt({
          hash: transactionHash as `0x${string}`
        });

        console.log('Reçu de transaction de vote:', receipt);

        // Si la transaction a réussi, vérifier les événements VoteCast
        if (receipt.status === 'success') {
          console.log('Transaction de vote réussie, vérification des événements VoteCast');

          // Récupérer les logs pour l'événement VoteCast dans cette transaction
          const logs = await (isDev ? hardhatClient : viemClient).getLogs({
            address: POST_MANAGER_ADDRESS as `0x${string}`,
            event: parseAbiItem('event VoteCast(uint256 indexed postId, address indexed voter, uint8 vote, uint256 stakeAmount)'),
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber
          });

          console.log('Logs d\'événements VoteCast trouvés:', logs);

          // Filtrer les logs pour l'adresse de l'utilisateur et le post ID
          const userLogs = logs.filter(log => {
            return log.args && (
              (log.args.voter && log.args.voter.toLowerCase() === address.toLowerCase()) &&
              (log.args.postId && BigInt(log.args.postId) === BigInt(id))
            );
          });

          console.log('Logs filtrés pour l\'utilisateur et le post:', userLogs);

          if (userLogs.length > 0) {
            // Marquer l'utilisateur comme ayant voté
            setHasVoted(true);
            setIsVoting(false);

            // Afficher une notification toast
            toast({
              title: "Vote enregistré avec succès !",
              description: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Votre vote a été enregistré sur la blockchain</span>
                </div>
              ),
              className: "bg-[#1A1927] border border-[#CF662D] text-white",
              duration: 5000,
            });
          } else {
            console.log('Aucun événement VoteCast trouvé pour cet utilisateur et ce post');
            setIsVoting(false);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des événements VoteCast:', error);
      setIsVoting(false);
    }
  };

  // Fonction pour soumettre un vote
  const handleVote = async (choice: number) => {
    if (!isConnected || !address) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour voter",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVoting(true);
      setVoteChoice(choice);

      // Afficher une notification toast pour indiquer que le vote est en cours
      toast({
        title: "Vote en cours",
        description: (
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#CF662D]" />
            <span>Votre vote est en cours de traitement...</span>
          </div>
        ),
        className: "bg-[#1A1927] border border-[#CF662D] text-white",
        duration: 5000,
      });

      // Créer un provider et un contrat DIVA
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const divaContract = new ethers.Contract(
        DIVA_TOKEN_ADDRESS,
        DIVA_TOKEN_ABI,
        signer
      );

      // Vérifier le solde de DIVA
      const balance = await divaContract.balanceOf(address);
      console.log('Solde DIVA de l\'utilisateur:', ethers.formatEther(balance));

      // Montant pour le vote (0.1 DIVA)
      const voteAmount = parseEther("0.1");

      if (balance < voteAmount) {
        setIsVoting(false);
        throw new Error(`Solde insuffisant. Vous avez ${ethers.formatEther(balance)} DIVA mais le vote nécessite 0.1 DIVA.`);
      }

      // Vérifier l'allowance actuelle
      const allowance = await divaContract.allowance(address, VOTING_CONTRACT_ADDRESS);
      console.log('Allowance actuelle:', ethers.formatEther(allowance));

      // Si l'allowance est insuffisante, effectuer une approbation explicite
      if (allowance < voteAmount) {
        console.log('Allowance insuffisante, demande d approbation...');

        toast({
          title: "Approbation nécessaire",
          description: (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#CF662D]" />
              <span>Veuillez approuver l&apos;utilisation de vos tokens DIVA...</span>
            </div>
          ),
          className: "bg-[#1A1927] border border-[#CF662D] text-white",
          duration: 5000,
        });

        // Approuver un montant suffisant (plus que nécessaire pour éviter des approbations futures)
        const approveTx = await divaContract.approve(VOTING_CONTRACT_ADDRESS, parseEther("1.0"));
        console.log('Transaction d\'approbation envoyée, hash:', approveTx.hash);

        // Attendre la confirmation de la transaction d'approbation
        await approveTx.wait();
        console.log('Approbation confirmée');

        // Vérifier la nouvelle allowance
        const newAllowance = await divaContract.allowance(address, VOTING_CONTRACT_ADDRESS);
        console.log('Nouvelle allowance après approbation:', ethers.formatEther(newAllowance));

        if (newAllowance < voteAmount) {
          setIsVoting(false);
          throw new Error('L\'approbation a échoué. Veuillez réessayer.');
        }
      }

      // Obtenir une signature valide pour le permit du token DIVA
      const { amount, deadline, v, r, s } = await getDivaSignatureForVote("0.1");

      console.log('Tentative de vote avec les paramètres suivants:');
      console.log('- Post ID:', id);
      console.log('- Choix:', choice);
      console.log('- Montant de stake:', amount.toString());
      console.log('- Deadline:', deadline.toString());
      console.log('- Signature v:', v);
      console.log('- Signature r:', r);
      console.log('- Signature s:', s);

      // Appeler la fonction vote du contrat Voting
      const tx = await writeVoteContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_CONTRACT_ABI,
        functionName: 'vote',
        args: [BigInt(id), BigInt(choice), amount, deadline, v, r, s],
      });

      console.log('Transaction de vote envoyée, hash:', tx);

      // La fermeture de la boîte de dialogue et l'affichage de la notification de succès
      // seront gérés par la fonction listenForVoteCastEvent
    } catch (err) {
      console.error('Erreur lors du vote:', err);
      setIsVoting(false);
    }
  };

  // Fonction pour tronquer une adresse Ethereum
  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Fonction pour avancer le temps sur la blockchain (uniquement en développement)
  const advanceTime = async (seconds: number) => {
    if (process.env.NODE_ENV !== 'development') {
      console.log('Avancer le temps n\'est possible qu\'en environnement de développement');
      return;
    }

    try {
      console.log(`Tentative d'avancer le temps de ${seconds} secondes...`);

      // Utiliser JSON-RPC pour avancer le temps sur Hardhat
      await fetch('http://localhost:8545', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'evm_increaseTime',
          params: [seconds],
          id: new Date().getTime(),
        }),
      });

      // Miner un nouveau bloc pour que le changement de temps prenne effet
      await fetch('http://localhost:8545', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'evm_mine',
          params: [],
          id: new Date().getTime(),
        }),
      });

      console.log(`Temps avancé de ${seconds} secondes avec succès`);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'avancement du temps:', error);
      return false;
    }
  };

  // Fonction pour finaliser le vote
  const finalizeVote = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour finaliser un vote",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFinalizing(true);

      // En développement, avancer le temps de 7 jours pour permettre la finalisation
      if (process.env.NODE_ENV === 'development') {
        const oneWeekInSeconds = 7 * 24 * 60 * 60; // 7 jours en secondes
        const timeAdvanced = await advanceTime(oneWeekInSeconds);

        if (timeAdvanced) {
          toast({
            title: "Temps avancé",
            description: "Le temps a été avancé de 7 jours pour permettre la finalisation du vote",
          });
        }
      }

      // Afficher une notification toast pour indiquer que la finalisation est en cours
      toast({
        title: "Finalisation du vote en cours",
        description: "Veuillez patienter pendant que nous finalisons le vote...",
      });

      // Appel au contrat PostManager pour finaliser le vote
      writeVoteContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_CONTRACT_ABI,
        functionName: 'finalizeAndDistribute',
        args: [BigInt(id)]
      });

      console.log('Transaction de finalisation envoyée');

      // Attendre un court délai pour laisser le temps à la transaction d'être traitée
      setTimeout(async () => {
        try {
          // Rechercher directement les événements VoteFinalized pour ce post
          await checkForVoteFinalized();
        } catch (error) {
          console.error("Erreur lors de la vérification des événements:", error);
        }
      }, 5000); // Attendre 5 secondes

    } catch (error) {
      console.error("Erreur lors de la finalisation du vote:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la finalisation du vote",
        variant: "destructive",
      });
      setIsFinalizing(false);
    }
  };

  // Fonction pour vérifier si le vote a été finalisé
  const checkForVoteFinalized = async () => {
    try {
      console.log('Vérification des événements VoteFinalized pour le post:', id);

      // Déterminer quel client utiliser en fonction de l'environnement
      const isDev = process.env.NODE_ENV === 'development';
      console.log('Environnement de développement:', isDev ? 'Oui' : 'Non');
      console.log('Client utilisé:', isDev ? 'hardhatClient' : 'viemClient');

      // Obtenir le numéro du bloc actuel
      const currentBlock = await (isDev ? hardhatClient : viemClient).getBlockNumber();
      console.log('Bloc actuel:', currentBlock);

      // Rechercher les événements VoteFinalized sur les 10 derniers blocs
      const fromBlock = currentBlock - BigInt(10) > 0 ? currentBlock - BigInt(10) : 0;
      console.log('Recherche d\'événements depuis le bloc:', fromBlock);

      // Obtenir les logs pour l'événement VoteFinalized
      const logs = await (isDev ? hardhatClient : viemClient).getLogs({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        event: parseAbiItem('event VoteFinalized(uint256 indexed postId, uint8 result, uint256 majority, uint256 totalRewarded, uint256 totalReturned, uint256 winnerCount, uint256 loserCount)'),
        fromBlock: BigInt(0),
        toBlock: 'latest'
      });

      console.log('Logs d\'événements VoteFinalized trouvés:', logs);

      // Filtrer les logs pour l'ID du post
      const postLogs = logs.filter(log => {
        // Vérifier que log.args et log.args.postId existent avant de les utiliser
        return log.args && log.args.postId && BigInt(log.args.postId.toString()) === BigInt(id);
      });

      console.log('Logs filtrés pour le post:', postLogs);

      if (postLogs.length > 0) {
        // Récupérer les résultats du vote
        const result = Number(postLogs[0].args.result);
        const majority = Number(postLogs[0].args.majority);

        console.log('Résultat du vote:', result === 1 ? 'VRAI' : result === 2 ? 'FAKE' : 'INDÉTERMINÉ');
        console.log('Majorité:', majority, '%');

        // Mettre à jour les états
        setVoteResult(result);
        setVoteMajority(majority);
        setIsVoteFinalized(true);

        // Afficher une notification toast pour indiquer que le vote a été finalisé
        toast({
          title: "Vote finalisé avec succès !",
          description: `Le résultat du vote est: ${result === 1 ? 'VRAI' : result === 2 ? 'FAKE' : 'INDÉTERMINÉ'} avec une majorité de ${majority}%`,
          variant: "default",
          duration: 5000,
        });
      } else {
        console.log('Aucun événement VoteFinalized trouvé pour ce post');

        // Si aucun événement n'est trouvé, réessayer après un délai
        setTimeout(checkForVoteFinalized, 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'événement VoteFinalized:', error);

      // Notification d'erreur
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les résultats du vote. Veuillez rafraîchir la page.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  // Fonction pour écouter l'événement VoteFinalized
  const listenForVoteCompletedEvent = async (txHash: `0x${string}`) => {
    try {
      console.log('Recherche de l\'événement VoteFinalized pour la transaction:', txHash);

      // Déterminer quel client utiliser en fonction de l'environnement
      const isDev = process.env.NODE_ENV === 'development';
      console.log('Environnement de développement:', isDev ? 'Oui' : 'Non');
      console.log('Client utilisé:', isDev ? 'hardhatClient' : 'viemClient');

      // Attendre que la transaction soit confirmée
      const receipt = await (isDev ? hardhatClient : viemClient).waitForTransactionReceipt({
        hash: txHash
      });

      console.log('Transaction confirmée, bloc:', receipt.blockNumber);

      // Obtenir les logs pour l'événement VoteFinalized
      const logs = await (isDev ? hardhatClient : viemClient).getLogs({
        address: VOTING_CONTRACT_ADDRESS,
        event: parseAbiItem('event VoteFinalized(uint256 indexed postId, uint8 result, uint256 majority, uint256 totalRewarded, uint256 totalReturned, uint256 winnerCount, uint256 loserCount)'),
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      console.log('Logs d\'événements VoteFinalized trouvés:', logs);

      // Filtrer les logs pour l'ID du post
      const postLogs = logs.filter(log => {
        return log.args && (
          (log.args.postId && BigInt(log.args.postId) === BigInt(id))
        );
      });

      console.log('Logs filtrés pour le post:', postLogs);

      if (postLogs.length > 0) {
        // Récupérer les résultats du vote
        const result = Number(postLogs[0].args.result);
        const majority = Number(postLogs[0].args.majority);

        console.log('Résultat du vote:', result === 1 ? 'VRAI' : result === 2 ? 'FAKE' : 'INDÉTERMINÉ');
        console.log('Majorité:', majority, '%');

        // Mettre à jour les états
        setVoteResult(result);
        setVoteMajority(majority);
        setIsVoteFinalized(true);

        // Afficher une notification toast pour indiquer que le vote a été finalisé
        toast({
          title: "Vote finalisé avec succès !",
          description: `Le résultat du vote est: ${result === 1 ? 'VRAI' : result === 2 ? 'FAKE' : 'INDÉTERMINÉ'} avec une majorité de ${majority}%`,
          variant: "default",
          duration: 5000,
        });
      } else {
        console.log('Aucun événement VoteFinalized trouvé pour ce post');
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de l\'événement VoteFinalized:', error);
    }
  };

  // Mettre à jour l'état quand la transaction de finalisation est confirmée
  useEffect(() => {
    if (isVoteSuccess && voteData && isFinalizing) {
      listenForVoteCompletedEvent(voteData);
    }
  }, [isVoteSuccess, voteData, isFinalizing]);

  // Obtenir le nom du domaine de l'URL
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch (error) {
    console.error("URL invalide:", url);
    domain = url;
    console.log(error);
  }

  // Formater l'horodatage
  const formattedTime = formatDistanceToNow(
    new Date(typeof timestamp === 'number' ? timestamp * 1000 : Date.now()),
    { addSuffix: true, locale: fr }
  );

  return (
    <div className="bg-[#252432] rounded-lg p-4 shadow-md mb-4 border border-[#CF662D]/20 hover:border-[#CF662D]/50 transition-colors">
      {/* En-tête du post */}
      <div className="flex items-center mb-3">
        <div className="rounded-full bg-[#CF662D] w-10 h-10 flex items-center justify-center text-white font-bold">
          {poster.substring(2, 4).toUpperCase()}
        </div>
        <div className="ml-3">
          <div className="font-medium">{shortenAddress(poster)}</div>
          <div className="text-xs text-gray-400">{formattedTime}</div>
        </div>
      </div>

      {/* Contenu du post - Version simplifiée */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${isVoteFinalized ? voteResult === 1 ? 'bg-green-900/20' : voteResult === 2 ? 'bg-red-900/20' : 'bg-[#1A1927]' : 'bg-[#1A1927]'} p-4 rounded-md hover:bg-[#1A1927]/80 transition-colors mb-2 relative`}
      >
        {isVoteFinalized && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold ${voteResult === 1 ? 'bg-green-600 text-white' : voteResult === 2 ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'}`}>
            {voteResult === 1 ? 'VRAI' : voteResult === 2 ? 'FAKE' : 'INDÉTERMINÉ'} ({voteMajority}%)
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="bg-[#CF662D]/20 p-2 rounded-md">
            <Globe className="h-8 w-8 text-[#CF662D]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold mb-1 text-white">{domain}</h3>
            <p className="text-sm text-gray-300 break-all">{url}</p>
            <div className="flex items-center text-xs text-[#CF662D] mt-2">
              <ExternalLink size={12} className="mr-1" />
              Ouvrir le lien
            </div>
          </div>
        </div>
      </a>

      {/* Boutons d'action */}
      <div className="flex justify-between mt-4 pt-2 border-t border-[#333243]">
        <Button
          variant="outline"
          className={`text-xs flex-1 mr-2 bg-transparent ${hasVoted && voteChoice === 1 ? 'border-green-600/50 text-green-500/50 cursor-not-allowed' : 'border-green-600 text-green-500 hover:bg-green-600/10 hover:text-green-400'} font-bold`}
          onClick={() => !hasVoted && !isVoting && handleVote(1)}
          disabled={hasVoted || isVoting || isVoteFinalized}
        >
          VRAI
        </Button>
        <Button
          variant="outline"
          className={`text-xs flex-1 bg-transparent ${hasVoted && voteChoice === 2 ? 'border-red-600/50 text-red-500/50 cursor-not-allowed' : 'border-red-600 text-red-500 hover:bg-red-600/10 hover:text-red-400'} font-bold`}
          onClick={() => !hasVoted && !isVoting && handleVote(2)}
          disabled={hasVoted || isVoting || isVoteFinalized}
        >
          FAKE
        </Button>

        {/* Bouton pour finaliser le vote (pour les tests) */}
        {isConnected && (
          <Button
            variant="outline"
            className="text-xs flex-1 ml-2 bg-transparent border-blue-600 text-blue-500 hover:bg-blue-600/10 hover:text-blue-400 font-bold"
            onClick={finalizeVote}
            disabled={isFinalizing || isVoteFinalized}
          >
            {isFinalizing ? "Finalisation..." : isVoteFinalized ? "Finalisé" : "Finaliser"}
          </Button>
        )}
      </div>
    </div>
  );
}
