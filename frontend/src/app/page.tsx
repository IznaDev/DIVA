'use client'
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAccount } from "wagmi";


export default function Home() {
  const { isConnected, address } = useAccount();
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ backgroundColor: '#1A1927' }}>
      <Header />
      <div className="p-5 grow flex flex-col items-center justify-center gap-8">
        <div className="w-full max-w-4xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Les Posts</h2>
        </div>
      </div>
      <Footer />
    </div>
  );
}
