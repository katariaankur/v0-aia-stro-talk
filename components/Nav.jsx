'use client';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { useEffect, useState } from 'react';

export default function Nav(){
  const [credits,setCredits]=useState(0);
  const [user,setUser]=useState(null);
  useEffect(()=>{
    const c=Number(localStorage.getItem('astrotalk:credits')||'0'); setCredits(c);
    const u=JSON.parse(localStorage.getItem('astrotalk:user')||'null'); setUser(u);
    const on=()=>setCredits(Number(localStorage.getItem('astrotalk:credits')||'0'));
    window.addEventListener('storage', on); return ()=>window.removeEventListener('storage', on);
  },[]);
  return (
    <div className="w-full border-b border-[color:var(--line)]">
      <div className="section h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-6 w-6 rounded-lg bg-[color:var(--brand)]"></span> AstroTalk <span className="text-[color:var(--accent)]">★</span>
        </Link>
        <Link href="/" className="px-2 py-1 rounded-lg hover:bg-gray-100">Home</Link>
        <Link href="/live" className="px-2 py-1 rounded-lg bg-gray-100">Live</Link>
        <Link href="/pricing" className="px-2 py-1 rounded-lg hover:bg-gray-100">Pricing</Link>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle/>
          <span className="pill">Credits: <b className="ml-1">{credits}</b></span>
          {user ? <Link href="/live" className="btn btn-outline">Hi {user.mobile}</Link> : <Link href="/login" className="btn btn-primary">Login</Link>}
        </div>
      </div>
    </div>
  );
}
