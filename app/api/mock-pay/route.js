export async function POST(req){
  const { plan, card, cvv, otp } = await req.json();
  const ok = card==='999999999999999' && cvv=='123' && otp=='9999';
  if(!ok) return Response.json({ ok:false }, { status:400 });
  const map={ standard:11, advanced:33, pro:99 };
  return Response.json({ ok:true, creditsAdded: map[plan]||0 });
}
