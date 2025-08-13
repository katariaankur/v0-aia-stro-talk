'use client';
import { useEffect, useState } from 'react';
export default function ThemeToggle(){
  const [dark,setDark]=useState(false);
  useEffect(()=>{ const t=localStorage.getItem('astrotalk:theme')==='dark'; setDark(t); document.documentElement.classList.toggle('dark', t); },[]);
  function toggle(){ const t=!dark; setDark(t); localStorage.setItem('astrotalk:theme', t?'dark':'light'); document.documentElement.classList.toggle('dark', t); }
  return <button onClick={toggle} className="pill">{dark?'🌙':'🔆'} Theme</button>;
}
