'use client';
export default function PlanCard({name, price, credits, cap, onBuy}){
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="text-xl font-semibold">{name}</div>
      <div className="text-3xl font-bold">${price}</div>
      <div className="text-sm text-gray-600">Adds {credits} credits • {cap}</div>
      <button onClick={onBuy} className="btn btn-primary mt-2">Buy</button>
    </div>
  );
}
