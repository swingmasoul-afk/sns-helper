// index.html 을 프레임 단위로 캡처해서 1080x1920 30fps MP4 로 인코딩
// 사용법: node render.js [출력파일=ep00-hair-again.mp4]
//         node render.js --stills 1.5,5,9   (해당 초의 PNG 미리보기만 저장)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30, DUR = 30;
const args = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1');
  await page.evaluate(() => document.fonts.ready);

  if (args[0] === '--stills') {
    for (const s of args[1].split(',').map(Number)) {
      await page.evaluate(t => render(t), s);
      await page.screenshot({ path: path.join(args[2] || '.', `still-${s}.png`) });
    }
    await browser.close();
    return;
  }

  const out = args[0] || path.join(__dirname, 'ep00-hair-again.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < FPS * DUR; i++) {
    await page.evaluate(t => render(t), i / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${FPS * DUR}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('done →', out);
})();
