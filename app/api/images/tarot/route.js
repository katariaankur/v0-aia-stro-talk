export const runtime='nodejs';
export async function GET(req){
  const name = new URL(req.url).searchParams.get('name')||'The Star';
  const w=240,h=360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="#F1EEFF" stroke="#7C5CFF"/>
    <circle cx="${w/2}" cy="${h/2-20}" r="60" fill="#7C5CFF" opacity="0.1"/>
    <text x="${w/2}" y="${h/2-16}" text-anchor="middle" font-size="64">★</text>
    <text x="${w/2}" y="${h-20}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#1f2937">${name}</text>
  </svg>`;
  return new Response(svg,{headers:{'Content-Type':'image/svg+xml'}});
}
