import { writeFileSync } from 'node:fs';
import { renderInsights } from './src/web/hook_web.ts';
const locked = renderInsights({ name:'Rico Vega', athleteId:'x', editHref:'/athlete/x/customize', channels:[], reach:0, followers:0, claims:0, presences:0, events:0 });
const open = renderInsights({ name:'Rico Vega', athleteId:'x', editHref:'/athlete/x/customize', channels:['instagram','tiktok','youtube'], reach:184, followers:1240, claims:312, presences:214, events:6 });
writeFileSync('../furia-DESIGN-insights-locked.html', locked);
writeFileSync('../furia-DESIGN-insights.html', open);
console.log('wrote insights previews', locked.length, open.length);
process.exit(0);
