export const runtime='nodejs';
function loshuCounts(dob){
  const digits = dob.replace(/[^0-9]/g,'').split('').map(d=>parseInt(d)).filter(d=>d>0);
  const counts = Array(10).fill(0); digits.forEach(d=>counts[d]++);
  return counts;
}
export async function GET(req){
  const url = new URL(req.url); const dob=url.searchParams.get('dob')||'1990-01-01';
  const c = loshuCounts(dob);
  const size=300, cell=size/3;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" rx="16" fill="#fff" stroke="#e5e7eb"/>`;
  for(let i=1;i<3;i++){ const p=i*cell; svg+=`<line x1="${p}" y1="0" x2="${p}" y2="${size}" stroke="#e5e7eb"/>`; svg+=`<line x1="0" y1="${p}" x2="${size}" y2="${size}" stroke="#e5e7eb"/>`; }
  const map={1:[0,2],2:[1,2],3:[2,2],4:[0,1],5:[1,1],6:[2,1],7:[0,0],8:[1,0],9:[2,0]};
  for(let n=1;n<=9;n++){ const [cx,cy]=map[n]; const x=cx*cell+cell/2, y=cy*cell+cell/2;
    svg+=`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="28" fill="#1f2937">${n}${'•'.repeat(c[n])}</text>`;
  }
  svg+='</svg>';
  return new Response(svg,{headers:{'Content-Type':'image/svg+xml'}});
}
