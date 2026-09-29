import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
console.log('registered Outfit:', GlobalFonts.registerFromPath('assets/fonts/Outfit[wght].ttf', 'Outfit'));
console.log('registered Mono:', GlobalFonts.registerFromPath('assets/fonts/JetBrainsMono[wght].ttf', 'JBMono'));
const c = createCanvas(600, 200), x = c.getContext('2d');
x.fillStyle = '#0a0d16'; x.fillRect(0, 0, 600, 200);
x.fillStyle = '#ffc247';
for (const [i, w] of [400, 700, 900].entries()) {
  x.font = `${w} 34px Outfit`;
  x.fillText(`Outfit ${w} Pink Diamond`, 20, 45 + i * 45);
}
x.font = '700 24px JBMono'; x.fillStyle = '#3ee0d0';
x.fillText('1 in 2.3M  ·  $6M', 20, 185);
const { writeFileSync } = await import('node:fs');
writeFileSync('fonttest.png', c.toBuffer('image/png'));
console.log('measure 900:', (x.font = '900 34px Outfit', x.measureText('Pink Diamond').width.toFixed(1)));
console.log('measure 400:', (x.font = '400 34px Outfit', x.measureText('Pink Diamond').width.toFixed(1)));
