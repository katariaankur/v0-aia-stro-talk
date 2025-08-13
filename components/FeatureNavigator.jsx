'use client';
export default function FeatureNavigator({ onPick }){
  const items = [
    {k:'palm', label:'Palm'},
    {k:'face', label:'Face'},
    {k:'tarot', label:'Tarot'},
    {k:'loshu', label:'Lo Shu'},
    {k:'kundli', label:'Kundli'},
  ];
  return (
    <div className="flex gap-2 flex-wrap mb-2">
      {items.map(it=>(
        <button key={it.k} className="pill" onClick={()=>onPick(it.k)}>{it.label}</button>
      ))}
    </div>
  );
}
