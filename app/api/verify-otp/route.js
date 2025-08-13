export async function POST(req){
  const { mobile, otp } = await req.json();
  if(otp==='9999') return Response.json({ ok:true, credits:6 });
  return Response.json({ ok:false }, { status:400 });
}
