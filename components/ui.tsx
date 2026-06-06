export function Metric({label,value,sub}:{label:string,value:string,sub?:string}){return <div className="metric"><p className="text-xs font-bold text-slate-500 uppercase">{label}</p><h3 className="mt-2 text-3xl font-black text-navy">{value}</h3>{sub&&<p className="text-xs text-slate-500 mt-1">{sub}</p>}</div>}

export function Status({text}:{text:string}){
  let className = 'badge ';
  const lower = text.toLowerCase();
  if(lower.includes('critique')) className += 'bg-red-100 text-red-700';
  else if(lower.includes('élevé') || lower.includes('eleve')) className += 'bg-orange-100 text-orange-700';
  else if(lower.includes('moyen')) className += 'bg-yellow-100 text-yellow-700';
  else className += 'bg-emerald-100 text-emerald-700';
  return <span className={className}>{text}</span>
}

export function SeverityBadge({severity}:{severity:string}){
  let className = 'badge ';
  const lower = severity?.toLowerCase() || '';
  if(lower === 'critique') className += 'bg-red-100 text-red-700';
  else if(lower === 'eleve' || lower === 'élevé') className += 'bg-orange-100 text-orange-700';
  else if(lower === 'moyen') className += 'bg-yellow-100 text-yellow-700';
  else className += 'bg-emerald-100 text-emerald-700';
  return <span className={className}>{severity}</span>
}
