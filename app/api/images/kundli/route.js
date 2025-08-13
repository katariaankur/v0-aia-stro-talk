export const runtime='nodejs';
export async function GET(req){
  const size = 360;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="#fff" stroke="#e5e7eb"/>`;
  // simple north chart diamond
  const c=size/2; const m=16;
  svg += `<polygon points="${c},${m} ${size-m},${c} ${c},${size-m} ${m},${c}" fill="none" stroke="#7C5CFF" stroke-width="2"/>`;
  for(let i=0;i<12;i++){ const angle=i*Math.PI/6; const x=c+(c-m-10)*Math.cos(angle); const y=c+(c-m-10)*Math.sin(angle);
    svg += `<text x="${x}" y="${y}" font-size="10" text-anchor="middle" fill="#111827">${i+1}</text>`; }
  svg += `<text x="${c}" y="${size-6}" text-anchor="middle" font-size="10" fill="#6b7280">Basic chart (demo)</text>`;
  svg += `</svg>`;
  return new Response(svg,{headers:{'Content-Type':'image/svg+xml'}});
}
