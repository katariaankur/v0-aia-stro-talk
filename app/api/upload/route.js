export const runtime='nodejs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req){
  const form = await req.formData();
  const file = form.get('file');
  if(!file) return new Response(JSON.stringify({ok:false}),{status:400});
  const dir = join(process.cwd(),'public','uploads');
  await mkdir(dir, { recursive: true });
  const name = Date.now()+'-'+(file.name||'file.webm');
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  return Response.json({ ok:true, url:'/uploads/'+name });
}
