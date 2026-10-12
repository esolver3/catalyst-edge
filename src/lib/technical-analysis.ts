/** Deterministic, explainable chart research. No orders, no AI-generated prices. */
export type Candle={time:number;open:number;high:number;low:number;close:number;volume:number};
export type ChartAnalysis={support:number;resistance:number;fib:{level:number;price:number}[];rsi14:number|null;macd:{line:number;signal:number;histogram:number}|null;volumeRatio:number|null;trend:"bullish"|"bearish"|"mixed";warnings:string[];asOf:number};
function ema(values:number[],period:number):number[]{if(values.length<period)return [];const seed=values.slice(0,period).reduce((a,b)=>a+b,0)/period;const out=[seed];const k=2/(period+1);for(const value of values.slice(period))out.push(value*k+out[out.length-1]*(1-k));return out}
export function analyzeCandles(candles:Candle[]):ChartAnalysis{
 if(candles.length<2||candles.length>5000)throw new Error("Need 2 to 5000 candles");
 for(let i=0;i<candles.length;i++){const c=candles[i];if(![c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.low<=0||c.volume<0||c.low>Math.min(c.open,c.close)||c.high<Math.max(c.open,c.close)||(i>0&&c.time<=candles[i-1].time))throw new Error("Invalid or unordered OHLCV candles")}
 const high=Math.max(...candles.map(c=>c.high)),low=Math.min(...candles.map(c=>c.low)),range=high-low,close=candles.map(c=>c.close);
 const fib=[0,.236,.382,.5,.618,.786,1].map(level=>({level,price:high-range*level}));
 let rsi14:number|null=null;
 if(close.length>=15){let gains=0,losses=0;for(let i=1;i<=14;i++){const delta=close[i]-close[i-1];gains+=Math.max(delta,0);losses+=Math.max(-delta,0)}gains/=14;losses/=14;for(let i=15;i<close.length;i++){const d=close[i]-close[i-1];gains=(gains*13+Math.max(d,0))/14;losses=(losses*13+Math.max(-d,0))/14}rsi14=losses===0?(gains===0?50:100):100-100/(1+gains/losses)}
 const fast=ema(close,12),slow=ema(close,26);let macd:ChartAnalysis["macd"]=null;
 if(slow.length>=9){const lineSeries=slow.map((v,i)=>fast[i+14]-v);const signals=ema(lineSeries,9);const line=lineSeries.at(-1)!,signal=signals.at(-1)!;macd={line,signal,histogram:line-signal}}
 const previous=candles.slice(-21,-1);const average=previous.length>=5?previous.reduce((s,c)=>s+c.volume,0)/previous.length:0;
 const volumeRatio=average>0?candles.at(-1)!.volume/average:null;
 const trend=macd===null?"mixed":macd.histogram>0&&rsi14!==null&&rsi14>50?"bullish":macd.histogram<0&&rsi14!==null&&rsi14<50?"bearish":"mixed";
 return {support:low,resistance:high,fib,rsi14,macd,volumeRatio,trend,warnings:[...(candles.length<35?["Limited history: MACD may be unavailable or unstable"]:[]),"Fibonacci levels are descriptive, not predictive","Token unlock dates and amounts require a separate verified source"],asOf:candles.at(-1)!.time};
}
