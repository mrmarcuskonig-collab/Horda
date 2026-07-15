import { renderAbout, renderAboutCreators, renderAboutFeatures, renderAboutPricing } from './src/web/pitch.ts';
for (const [n,h] of [['about',renderAbout(true)],['creators',renderAboutCreators(true)],['features',renderAboutFeatures(true)],['pricing',renderAboutPricing(true)]] as [string,string][]) {
  const okAnton = h.includes('Anton'); const okEmber = h.includes('--ember'); const okDisp = h.includes('bighero')||h.includes('phero');
  console.log(n, 'Anton',okAnton,'ember',okEmber,'hero',okDisp, 'len',h.length);
}
