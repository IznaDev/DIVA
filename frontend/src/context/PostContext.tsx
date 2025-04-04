'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Post } from '@/types';
import { parseAbiItem } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { POST_MANAGER_ADDRESS } from '@/constants';

interface PostContextType {
  posts: Post[];
  addPost: (post: Post) => void;
  fetchPosts: () => Promise<void>;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

export function PostProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // Log l'état des posts uniquement au débug, pas dans un useEffect pour éviter
  // de déclencher des rendus supplémentaires
  const logPosts = () => {
    console.log("=== État actuel des posts dans le contexte ===");
    console.log(`Nombre total de posts: ${posts.length}`);
    posts.forEach((post, index) => {
      console.log(`Post ${index + 1}:`, {
        id: post.id?.toString(),
        url: post.contentUrl,
        poster: post.poster,
        timestamp: post.timestamp
      });
    });
  };

  const addPost = (post: Post) => {
    console.log("Tentative d'ajout d'un post au contexte:", post);
    // Éviter les doublons en vérifiant si l'URL existe déjà
    setPosts(prevPosts => {
      // Vérifier si un post avec la même URL existe déjà
      const existingPostIndex = prevPosts.findIndex(p => p.contentUrl === post.contentUrl);

      if (existingPostIndex >= 0) {
        console.log("Post déjà présent dans la liste, ignoré:", post.contentUrl);

        // Nous ne mettons plus à jour l'ID pour éviter les boucles infinies
        // Simplement retourner la liste existante
        return prevPosts;
      }

      console.log("Ajout d'un nouveau post au contexte:", post.contentUrl);
      return [...prevPosts, post];
    });
  };

  // Fonction pour récupérer les posts depuis la blockchain
  const fetchPosts = async () => {
    if (!publicClient) return;

    try {
      console.log("Récupération des posts depuis la blockchain...");

      // Récupérer les événements PostCreated
      const logs = await publicClient.getLogs({
        address: POST_MANAGER_ADDRESS as `0x${string}`,
        event: parseAbiItem('event PostCreated(uint256 indexed postId, address indexed poster, string contentUrl)'),
        fromBlock: 0n,
        toBlock: 'latest'
      });

      console.log("Événements PostCreated récupérés:", logs);

      // Traiter les logs pour créer des objets Post
      const newPosts = logs.map(log => {
        if (!log.args) return null;

        return {
          id: log.args.postId,
          poster: log.args.poster as string,
          contentUrl: log.args.contentUrl as string,
          timestamp: Number(new Date())
        };
      }).filter(post => post !== null) as Post[];

      console.log("Posts récupérés:", newPosts);

      // Mettre à jour l'état des posts en évitant les doublons
      setPosts(prevPosts => {
        const existingUrls = new Set(prevPosts.map(p => p.contentUrl));
        const uniqueNewPosts = newPosts.filter(p => !existingUrls.has(p.contentUrl));

        return [...prevPosts, ...uniqueNewPosts];
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des posts:", error);
    }
  };

  // Récupérer les posts au chargement et quand l'utilisateur se connecte
  useEffect(() => {
    if (isConnected && publicClient) {
      fetchPosts();
    }
  }, [isConnected, publicClient]);

  return (
    <PostContext.Provider value={{ posts, addPost, fetchPosts }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePostContext() {
  const context = useContext(PostContext);
  if (context === undefined) {
    throw new Error('usePostContext must be used within a PostProvider');
  }
  return context;
}
