'use client';
import Nav from '@/components/Nav';
import PlanCard from '@/components/PlanCard';
import { useState } from 'react';

export default function Pricing(){
  const [show,setShow]=useState(false);
  const [plan,setPlan]=useState(null);
  const [card,setCard]=useState('999999999999999');
  const [cvv,setCvv]=useState('123');
  const [potp,setPotp]=useState('9999');

  async function buy(p){
    setPlan(p); setShow(true);
  }
  async function pay(e){ e.preventDefault();
    const r=await fetch('/api/mock-pay',{method:'POST',body:JSON.stringify({plan,card,cvv,otp:potp})});
    const j=await r.json();
    if(j.ok){
      const cur=Number(localStorage.getItem('astrotalk:credits')||'0') + Number(j.creditsAdded||0);
      localStorage.setItem('astrotalk:credits', String(cur));
      localStorage.setItem('astrotalk:plan', plan);
      alert('Payment success. Credits added.');
      setShow(false);
    } else alert('Payment failed');
  }

  return (<main>
    <Nav/>
    <div className="section py-10 grid md:grid-cols-3 gap-4">
      <PlanCard name="Standard" price="9" credits={11} cap="3 min/session" onBuy={()=>buy('standard')}/>
      <PlanCard name="Advanced" price="49" credits={33} cap="6 min/session" onBuy={()=>buy('advanced')}/>
      <PlanCard name="Pro" price="99" credits={99} cap="Unlimited" onBuy={()=>buy('pro')}/>
    </div>

    {show && <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <form onSubmit={pay} className="card p-6 w-[380px] bg-white">
        <div className="text-lg font-semibold mb-2">Mock Checkout ({plan})</div>
        <input className="input mb-2" value={card} onChange={e=>setCard(e.target.value)} placeholder="Card 999999999999999"/>
        <div className="flex gap-2">
          <input className="input flex-1" value={cvv} onChange={e=>setCvv(e.target.value)} placeholder="CVV 123"/>
          <input className="input flex-1" value={potp} onChange={e=>setPotp(e.target.value)} placeholder="OTP 9999"/>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary flex-1">Pay</button>
          <button type="button" className="btn btn-outline flex-1" onClick={()=>setShow(false)}>Cancel</button>
        </div>
      </form>
    </div>}
  </main>);
}
