'use client';

import { useState, useEffect } from 'react';
import PostCard from './PostCard';
import { usePostContext } from '@/context/PostContext';

// Utilisation du type Post depuis @/types

export default function PostFeed() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { posts } = usePostContext(); // Récupérer les posts depuis le contexte

  // Fonction de débogage sans useEffect pour éviter les boucles infinies
  const debugPosts = () => {
    console.log("PostFeed: posts disponibles", {
      count: posts.length,
      posts: posts.map(p => ({ url: p.contentUrl, poster: p.poster }))
    });
  };
  
  // Exécuter une seule fois pour le débogage
  // debugPosts(); // Décommenter pour déboguer

  // Plus besoin de récupérer les posts, ils viennent du contexte
  // Le contexte est maintenant alimenté par PurchaseDivasButton.tsx quand un nouveau post est créé

  // Plus besoin de surveiller les nouveaux posts, le contexte s'en charge via PurchaseDivasButton.tsx

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Fil d'actualité</h2>
      
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#252432] rounded-lg p-4 shadow-md animate-pulse h-64"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#252432] p-4 rounded-lg border border-red-500 text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-[#CF662D] hover:underline"
          >
            Rafraîchir la page
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-[#252432] p-6 rounded-lg text-center">
          <p className="text-gray-400 mb-2">Aucun post n'a encore été publié</p>
          <p className="text-sm text-gray-500">Soyez le premier à publier du contenu !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard 
              key={post.contentUrl}
              id={typeof post.id === 'bigint' ? post.id.toString() : '0'}
              url={post.contentUrl}
              poster={post.poster}
              timestamp={post.timestamp ?? Date.now()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
