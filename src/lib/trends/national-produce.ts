import snapshot from '../../data/mofcom-produce.json';
import type { Instrument } from './model';
// Compact storage shares the verified weekly date axis; no dates or values are interpolated.
export const nationalProduceBootstrap:Instrument[] = snapshot.items.map(item=>({
 ...snapshot.metadata,id:item.id,name:item.name,retrievedAt:snapshot.retrievedAt,
 sourceUpdatedAt:snapshot.dates.at(-1),
 points:snapshot.dates.map((date,index)=>({date,value:item.values[index]})),
}));
