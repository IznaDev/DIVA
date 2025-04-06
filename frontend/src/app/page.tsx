'use client'

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostFeed from "@/components/PostFeed";


export default function Home() {
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ backgroundColor: '#1A1927' }}>
      <Header />
      <div className="p-5 grow flex flex-col items-center justify-start gap-8 pt-8">
        {/* Remplacer le titre par le PostFeed qui contient son propre titre */}
        <div className="w-full max-w-4xl">
          <PostFeed />
        </div>
      </div>
      <Footer />
    </div>
  );
}
