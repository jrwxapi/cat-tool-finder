'use strict';

const DRIVES = ['1/4', '3/8', '1/2', '3/4', '1', '1 1/2'];
function normalizeDrive(value) {
  const s = String(value).trim().replace(/(\d)-(\d+\/\d+)/g,'$1 $2').replace(/["′″']/g, '').replace(/\b(?:inches|inch|in)\b/gi, '').trim();
  const numbers = {'0.25':'1/4','0.250':'1/4','0.375':'3/8','0.5':'1/2','0.50':'1/2','0.500':'1/2','0.75':'3/4','0.750':'3/4','1.0':'1','1.00':'1','1.5':'1 1/2'};
  return numbers[s] || (DRIVES.includes(s) ? s : null);
}
function toolUse(value) {
  const text=String(value||'');
  if (/\bnon[- ]impact\b|\bhand[- ](?:use|sockets?)\b|\b(?:not|never)\s+(?:recommended\s+|suitable\s+|rated\s+|designed\s+)?(?:for\s+)?(?:use\s+)?(?:with\s+)?impact\b/i.test(text)) return ['Hand / non-impact'];
  if (/\bimpact[- ](?:(?:swivel|universal|deep|shallow|standard|metal|lock|removal|square|drive|fractional|metric|6|12|point)[- ]+)*(?:sockets?|extensions?|adapt(?:er|or)s?|drivers?|wrench(?:es)?|rated|use|tools?)\b|\b(?:sockets?|extensions?|adapt(?:er|or)s?)\s*[-,:]\s*impact\b/i.test(text)) return ['Impact'];
  return [];
}
function toolFinish(value, explicitField=false) {
  const text=String(value||'');
  if (/\bchrome(?:[- ](?:plated|coated|finish|finished|coating|plating))\b|\bpolished\s+chrome\b|\b(?:finish|coating)\s*:\s*(?:polished\s+)?chrome\b/i.test(text) || (explicitField && /\bchrome\b(?![- ](?:vanadium|molybdenum|alloy))/i.test(text))) return ['Chrome'];
  if (/\bblack[- ]oxide\b/i.test(text)) return ['Black oxide'];
  return explicitField && text.trim() ? ['Other finish'] : [];
}
function classify(r) {
  const attributes = r.attributes || {};
  const title = r.title.replace(new RegExp('^'+r.id+':\\s*'), '');
  const text = [title, r.description, r.fullDescription||'', ...Object.entries(attributes).map(([k,v])=>`${k}: ${v}`)].join(' ');
  const name = `${title} ${r.description}`;
  const detailedName = `${name} ${r.fullDescription||''}`;
  let type = 'Other';
  if (/\bsets?\b|\b\d+\s*[- ]?\s*pieces?\b/i.test(title)) type = /ratchet/i.test(name) && !/socket/i.test(name) ? 'Ratchet set' : /socket/i.test(name) ? 'Socket set' : /bit/i.test(name) ? 'Bit set' : 'Tool set';
  else if (/\badapt(?:er|or)\b/i.test(name)) type = 'Adapter';
  else if (/\bextensions?\b/i.test(name)) type = 'Extension';
  else if (/breaker bar/i.test(name)) type = 'Breaker bar';
  else if (/ratchet/i.test(name)) type = 'Ratchet';
  else if (/universal joint/i.test(name) && !/socket/i.test(name)) type = 'Universal joint';
  else if (/socket/i.test(name)) type = 'Socket';
  else if (/\bbit\b|\bdriver\b/i.test(name)) type = 'Bit / driver';
  const socketRelated = /Socket|Bit set|Tool set/.test(type);
  const points = [...new Set([...text.matchAll(/\b(6|12)\s*[- ]?\s*points?\b/gi)].filter(m=>!/(?:compared\s+to|rather\s+than|instead\s+of|unlike|versus)\s*$/i.test(text.slice(Math.max(0,m.index-30),m.index))).map(m=>m[1]))];
  if (/\bdouble[- ]hex(?:agonal|agon)?\b|\btwelve[- ]points?\b/i.test(detailedName) && !points.includes('12')) points.push('12');
  if (/\bsix[- ]points?\b/i.test(detailedName) && !points.includes('6')) points.push('6');
  if (/\bsingle[- ]hex(?:agonal|agon)?\b/i.test(detailedName) && !points.includes('6')) points.push('6');
  const depth = [];
  if (/\bdeep(?:[- ]well)?\b/i.test(detailedName+' '+(attributes.Type||'')+' '+(attributes['Socket Type']||''))) depth.push('Deep');
  if (/\bshallow\b|\bstandard[- ](?:length|depth)\b/i.test(detailedName+' '+(attributes.Type||'')+' '+(attributes['Socket Type']||''))) depth.push('Shallow');
  const drive = new Set();
  const evidence = [];
  for (const [key,value] of Object.entries(attributes)) {
    if (/^(?:square\s*)?drive(?: size)?\s*\(in\)$/i.test(key)) {
      for(const v of String(value).split(/\s*[,;]\s*/)){const d=normalizeDrive(v);if(d){drive.add(d);evidence.push(`${key}: ${value}`);}}
    }
    if (/^(?:square\s*)?drive(?: size)?\s*\(mm\)$/i.test(key)) {const metric={'6.35':'1/4','9.525':'3/8','12.7':'1/2','19.05':'3/4','25.4':'1','38.1':'1 1/2'};const d=metric[String(Number(value))];if(d){drive.add(d);evidence.push(`${key}: ${value}`);}}
  }
  const drivePattern = /\b(1[-\s]+1\/2|1\/4|3\/8|1\/2|3\/4|0\.25|0\.375|0\.5|0\.75|1\.5|1)\s*(?:["'′″]{1,2}|inch(?:es)?\b|in\b)?\s*(?:square\s*)?drive\b/gi;
  for (const m of detailedName.matchAll(drivePattern)) {
    if (/\b(?:through|to)\s*$/i.test(detailedName.slice(Math.max(0,m.index-18),m.index))) continue;
    const d=normalizeDrive(m[1]);if(d){drive.add(d);evidence.push(m[0]);}
  }
  for(const m of detailedName.matchAll(/\b(?:square\s*)?drive(?:\s+size)?(?:\s*\((?:inch(?:es)?|in|female|male)\))?\s*:\s*(1\s+1\/2|1\/4|3\/8|1\/2|3\/4|0\.25|0\.375|0\.5|0\.75|1\.5|1)\b/gi)){
    const d=normalizeDrive(m[1]);if(d){drive.add(d);evidence.push(m[0]);}
  }
  if (type==='Adapter') {
    for(const [k,v] of Object.entries(attributes)) if (/^Size \(in\)$/.test(k) && /male|female/i.test(v)) {
      for(const m of String(v).matchAll(/\b(1\s+1\/2|1\/4|3\/8|1\/2|3\/4|1)\b/g)){const d=normalizeDrive(m[1]);if(d)drive.add(d);}
    }
  }
  if(type==='Breaker bar' && !drive.size){const m=name.match(/\b(1\/4|3\/8|1\/2|3\/4|1)\s*["'′″]{1,2}\s*Square\b/i);if(m){drive.add(m[1]);evidence.push(m[0]);}}
  const system = new Set();
  if (socketRelated && /\bmetric\b|\b\d+(?:\.\d+)?\s*mm\b(?!\s+(?:long|length|diameter|outer|thick))/i.test(name)) system.add('Metric');
  if (socketRelated && /\bSAE\b|\bfractional\b/i.test(name)) system.add('SAE');
  if(socketRelated && /\bmetric\b|\bmillimeters?\s+socket\s+sizes?\b/i.test(r.fullDescription||''))system.add('Metric');
  if(socketRelated && /\bSAE\b|\bfractional\b/i.test(r.fullDescription||''))system.add('SAE');
  // Cat's unit switch hides native metric socket-size fields in the US view.
  // Use size fields only for sockets, never a metric overall length or drive.
  if(socketRelated && !system.size){
    if(Object.keys(attributes).some(k=>/^(?:Hex )?Size \(in\)$/.test(k))) system.add('SAE');
    else if(Object.keys(attributes).some(k=>/^(?:Hex )?Size \(mm\)$/.test(k))) system.add('Metric');
  }
  const priceMatch = r.priceText && r.priceText.match(/\$\s*([\d,]+\.\d{2})/);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g,'')) : null;
  let size='';
  if(socketRelated){
    const mm=name.match(/\b(\d+(?:\.\d+)?)\s*mm\b(?!\s+(?:long|length|diameter|outer|thick))/i);
    const inch=name.match(/\b(\d+[ -]\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:inch(?:es)?\b|in\b|["'′″]{1,2})\s*(?=\)|hex|socket|$)/i);
    if(system.has('Metric')&&mm)size=mm[1]+' mm';
    else if(system.has('SAE')&&inch)size=inch[1]+' in';
    else{const unit=system.has('Metric')?'mm':'in';const value=attributes[`Size (${unit})`]||attributes[`Hex Size (${unit})`];if(value && /^[\d./\s"'−–-]+(?:\s+to\s+[\d./\s"'−–-]+)?$/.test(value))size=value+' '+unit;}
  }
  const catalogFilled=[],catalogConflicts=[];
  let use=[],finish=[];
  const useEvidence=[],finishEvidence=[];
  const useFields=Object.entries(attributes).filter(([k])=>/^(?:tool |socket )?type$|impact|^(?:use|application|usage)$/i.test(k)).map(([k,v])=>[`${k}: ${v}`,`Website ${k}`]);
  for(const [value,source] of [[title,'Website title'],...useFields,[r.description,'Website summary'],[r.fullDescription,'Website full description']]){
    const found=toolUse(value);if(found.length){use=found;useEvidence.push(source);break;}
  }
  const finishFields=Object.entries(attributes).filter(([k])=>/finish|coating|plating/i.test(k));
  for(const [k,v] of finishFields){const found=toolFinish(v,true);if(found.length){finish=found;finishEvidence.push(`Website ${k}: ${v}`);break;}}
  if(!finish.length)for(const [value,source] of [[title,'Website title'],[r.description,'Website summary'],[r.fullDescription,'Website full description']]){
    const found=toolFinish(value);if(found.length){finish=found;finishEvidence.push(source);break;}
  }
  const specification=r.catalogSpecification;
  if(specification){
    for(const [key,values,value] of [['drive',drive,specification.drive],['points',points,specification.points],['depth',depth,specification.depth]]){
      if(!value)continue;
      const current=values instanceof Set?[...values]:values;
      if(!current.length){values instanceof Set?values.add(value):values.push(value);catalogFilled.push(key);}
      else if(!current.includes(value))catalogConflicts.push(`${key}: website ${current.join(', ')}; 2008 catalog ${value}`);
    }
    if(socketRelated&&!system.size){[specification,...(specification.alternates||[])].forEach(s=>system.add(s.system));catalogFilled.push('system');}
    if(socketRelated&&!size){size=specification.size;catalogFilled.push('size');}
    if(catalogFilled.includes('drive'))evidence.push('2008 Cat catalog, PDF page '+specification.page);
    const oldUse=toolUse(specification.heading),oldFinish=/\bchrome\b/i.test(specification.heading||'')?['Chrome']:toolFinish(specification.heading);
    for(const [key,current,old,sourceEvidence] of [['use',use,oldUse,useEvidence],['finish',finish,oldFinish,finishEvidence]]){
      if(!old.length)continue;
      if(!current.length){current.push(...old);catalogFilled.push(key);sourceEvidence.push('2008 Cat catalog, PDF page '+specification.page);}
      else if(!old.every(v=>current.includes(v)))catalogConflicts.push(`${key}: website ${current.join(', ')}; 2008 catalog ${old.join(', ')}`);
    }
  }
  return {...r,title,type,points,depth,drive:[...drive].sort((a,b)=>DRIVES.indexOf(a)-DRIVES.indexOf(b)),system:[...system],use,finish,useEvidence,finishEvidence,price,currency:'USD',size,catalogFilled,catalogConflicts,driveEvidence:[...new Set(evidence)],socketRelated,impact:use.includes('Impact'),searchText:normalizeSearch([text,type,size,...use,...finish,...system,...depth,...points.map(p=>p+' point'),...[...drive].map(d=>d+' drive')].join(' '))};
}
function normalizeSearch(s){return String(s).toLowerCase().replace(/(\d)\s*-?\s*point/g,'$1 point').replace(/[®"'′″]/g,'').replace(/[^a-z0-9/ .-]+/g,' ').replace(/\s+/g,' ').trim();}
function matches(r, filters){
  const words=normalizeSearch(filters.query||'').split(' ').filter(Boolean);
  if(!words.every(w=>r.searchText.includes(w)||r.id.replace(/-/g,'').toLowerCase().includes(w.replace(/-/g,''))))return false;
  for(const key of ['points','depth','drive','system','type','use','finish']){
    const selected=filters[key]||[];if(!selected.length)continue;
    const values=Array.isArray(r[key])?r[key]:[r[key]];
    if(!selected.some(v=>v==='Unknown'?values.length===0:values.includes(v)) && !(filters.includeUnknown&&values.length===0))return false;
  }
  if(filters.min!==null&&filters.min!==undefined && (r.price===null||r.price<filters.min))return false;
  if(filters.max!==null&&filters.max!==undefined && (r.price===null||r.price>filters.max))return false;
  return true;
}
if(typeof module!=='undefined')module.exports={classify,matches,normalizeDrive,normalizeSearch,DRIVES};
