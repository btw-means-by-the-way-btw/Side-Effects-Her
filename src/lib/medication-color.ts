/** FNV-1a gives a stable visual identity, not encryption or a medical category. */
export function medicationColor(name:string):{hue:number;hex:string} {
 const normalized=name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
 let hash=2166136261;
 for(const character of normalized){hash^=character.codePointAt(0)!;hash=Math.imul(hash,16777619)>>>0;}
 const hue=hash%360,saturation=.55,lightness=.72;
 const chroma=(1-Math.abs(2*lightness-1))*saturation,x=chroma*(1-Math.abs((hue/60)%2-1)),m=lightness-chroma/2;
 const [r,g,b]=hue<60?[chroma,x,0]:hue<120?[x,chroma,0]:hue<180?[0,chroma,x]:hue<240?[0,x,chroma]:hue<300?[x,0,chroma]:[chroma,0,x];
 const hex="#"+[r,g,b].map(v=>Math.round((v+m)*255).toString(16).padStart(2,"0")).join("");
 return {hue,hex};
}
