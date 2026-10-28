import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = path.join(process.cwd(), 'data', 'crisis-twin.json');
const initial = {
  portfolios: [{ id: 'default', name: 'Main Growth Portfolio', user_id: 'user_default', cash_balance: 750000 }],
  holdings: [
    { id:'reliance',portfolio_id:'default',ticker:'RELIANCE.NS',name:'Reliance Industries',sector:'energy',quantity:345,avg_buy_price:2520,current_price:2515,beta:.7,weight:18,day_change_pct:.4 },
    { id:'indigo',portfolio_id:'default',ticker:'INDIGO.NS',name:'InterGlobe Aviation',sector:'airlines',quantity:98,avg_buy_price:4420,current_price:4390,beta:.85,weight:9,day_change_pct:-1.6 },
    { id:'hdfc',portfolio_id:'default',ticker:'HDFCBANK.NS',name:'HDFC Bank',sector:'banks',quantity:580,avg_buy_price:1660,current_price:1650,beta:.9,weight:20,day_change_pct:-.5 },
    { id:'tata',portfolio_id:'default',ticker:'TATAMOTORS.NS',name:'Tata Motors',sector:'auto',quantity:620,avg_buy_price:935,current_price:928,beta:1.05,weight:12,day_change_pct:-.9 },
    { id:'infy',portfolio_id:'default',ticker:'INFY.NS',name:'Infosys',sector:'it',quantity:435,avg_buy_price:1880,current_price:1885,beta:.8,weight:17,day_change_pct:.2 },
    { id:'sun',portfolio_id:'default',ticker:'SUNPHARMA.NS',name:'Sun Pharma',sector:'pharma',quantity:260,avg_buy_price:1850,current_price:1860,beta:.6,weight:10,day_change_pct:.7 },
    { id:'itc',portfolio_id:'default',ticker:'ITC.NS',name:'ITC',sector:'fmcg',quantity:1370,avg_buy_price:492,current_price:493,beta:.75,weight:14,day_change_pct:.1 }
  ], paper_trades:[], profiles:[], runs:[], agent_logs:[], drill_results:[]
};
export function readStore(){
  try { return JSON.parse(fs.readFileSync(STORE_PATH,'utf8')); }
  catch { fs.mkdirSync(path.dirname(STORE_PATH),{recursive:true}); writeStore(initial); return structuredClone(initial); }
}
export function writeStore(data){ fs.mkdirSync(path.dirname(STORE_PATH),{recursive:true}); const tmp=STORE_PATH+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(data,null,2)); fs.renameSync(tmp,STORE_PATH); }
export function mutateStore(fn){ const db=readStore(); const result=fn(db); writeStore(db); return result; }
export function now(){return new Date().toISOString();}
