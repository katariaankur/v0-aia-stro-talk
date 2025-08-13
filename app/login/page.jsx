'use client';
import Nav from '@/components/Nav';
import { useState } from 'react';

export default function Login(){
  const [step,setStep]=useState(1);
  const [mobile,setMobile]=useState('');
  const [otp,setOtp]=useState('');

  async function sendOtp(e){ e.preventDefault();
    await fetch('/api/mock-otp',{method:'POST',body:JSON.stringify({mobile})});
    setStep(2);
  }
  async function verify(e){ e.preventDefault();
    const r=await fetch('/api/verify-otp',{method:'POST',body:JSON.stringify({mobile,otp})});
    const j=await r.json();
    if(j.ok){
      localStorage.setItem('astrotalk:user', JSON.stringify({mobile}));
      localStorage.setItem('astrotalk:credits', String(j.credits));
      location.assign('/live');
    } else alert('Wrong OTP');
  }

  return (<main>
    <Nav/>
    <div className="section py-10 max-w-md">
      <div className="card p-6">
        {step===1? <form onSubmit={sendOtp} className="space-y-3">
          <div className="text-xl font-semibold">Login</div>
          <input className="input" placeholder="Mobile number" value={mobile} onChange={e=>setMobile(e.target.value)}/>
          <button className="btn btn-primary w-full">Send OTP</button>
        </form> : <form onSubmit={verify} className="space-y-3">
          <div className="text-xl font-semibold">Enter OTP</div>
          <input className="input" placeholder="OTP (9999)" value={otp} onChange={e=>setOtp(e.target.value)}/>
          <button className="btn btn-primary w-full">Verify</button>
          <div className="text-xs text-gray-500">Use 9999</div>
        </form>}
      </div>
    </div>
  </main>);
}
