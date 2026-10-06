import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#stage');
const beats = [...document.querySelectorAll('.beat')];
const ink = '#171917', paper = '#f2f4ed', lime = '#d6fa8b', coral = '#ff7965';
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#sculpture'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(1920, 1080, false);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture;
room.dispose();
const camera = new THREE.PerspectiveCamera(35, 1920 / 1080, .1, 80);
camera.position.set(0, 2, 14);
camera.lookAt(0, 0, 0);
scene.add(new THREE.AmbientLight(0xffffff, .7));
const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(-3, 8, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xccefa9, 2);
rim.position.set(7, 3, -5);
scene.add(rim);
const sculpture = new THREE.Group();
scene.add(sculpture);
const slabGeometry = new RoundedBoxGeometry(3.6, .09, 2.25, 3, .04);
const slabs = [];
for (let i = 0; i < 38; i++) {
  const material = new THREE.MeshPhysicalMaterial({ color: i % 7 === 0 ? 0xd6fa8b : 0x253c2d, metalness: .75, roughness: .24, clearcoat: 1, clearcoatRoughness: .15 });
  const mesh = new THREE.Mesh(slabGeometry, material);
  sculpture.add(mesh);
  slabs.push(mesh);
}
const data = document.querySelector('#data').getContext('2d');
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 4);
const lerp = (a, b, t) => a + (b - a) * t;
const labels = ['LOCAL INTELLIGENCE, IN MOTION', 'MODEL TRAINING / 模型训练', 'CHECKPOINT INTELLIGENCE / 训练洞察', 'REPRODUCIBLE SCORING / 可复查评分', 'RUNTIME TELEMETRY / 性能洞察', 'YOUR MODELS. YOUR MACHINE.'];
const trainingArchive = await fetch('../../docs/release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json').then(response => response.json());
const checkpointPoints = trainingArchive.validationSeries.filter(point => point.step >= 100 && point.step <= 800).map(point => [point.step, point.loss]);

function fit() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(${(innerWidth - 1920 * scale) / 2}px, ${(innerHeight - 1080 * scale) / 2}px) scale(${scale})`;
}
addEventListener('resize', fit);
fit();

function line(x1, y1, x2, y2, color, width = 1) {
  data.strokeStyle = color;
  data.lineWidth = width;
  data.beginPath(); data.moveTo(x1, y1); data.lineTo(x2, y2); data.stroke();
}
function text(value, x, y, size = 25, color = paper) {
  data.font = `${size}px Plex`;
  data.fillStyle = color;
  data.fillText(value, x, y);
}
function drawCurve(local) {
  const progress = ease((local - .4) / 2.7);
  const points = checkpointPoints;
  const x = step => 930 + (step - 100) / 700 * 850;
  const y = loss => 680 - (loss - .04) / .23 * 390;
  for (let i = 0; i < 5; i++) line(930, 300 + i * 95, 1780, 300 + i * 95, '#353a33');
  text('VALIDATION LOSS', 930, 234, 27, coral);
  text('0.250', 940, 290, 28);
  text('0.066', 1620, 756, 38, coral);
  text('100', 930, 827, 25, '#b4baaf'); text('800 STEPS', 1620, 827, 25, '#b4baaf');
  data.save();
  data.beginPath(); data.rect(920, 250, 880 * progress, 530); data.clip();
  data.beginPath();
  points.forEach(([step, loss], i) => i ? data.lineTo(x(step), y(loss)) : data.moveTo(x(step), y(loss)));
  data.strokeStyle = coral; data.lineWidth = 7; data.stroke();
  for (const [step, loss] of points) { data.fillStyle = coral; data.beginPath(); data.arc(x(step), y(loss), 7, 0, Math.PI * 2); data.fill(); }
  data.restore();
}
function drawSamples(local) {
  const fill = Math.round(500 * ease((local - .25) / 2.1));
  for (let i = 0; i < 500; i++) {
    const col = i % 25, row = Math.floor(i / 25);
    const x = 994 + col * 31, y = 269 + row * 26;
    data.fillStyle = i < fill ? '#365a42' : '#d5d9cf';
    data.fillRect(x, y, 17, 17);
  }
  line(994, 817, 1755, 817, '#b7c1ae');
  text(`${String(fill).padStart(3,'0')} / 500 SCORED`, 994, 870, 31, ink);
}
function drawRuntime(local, time) {
  const p = ease((local - .25) / 1.7);
  const names = ['MLX', 'OLLAMA', 'LLAMA.CPP'];
  const colors = [lime, coral, '#a9ccdf'];
  text('ARTISTIC TRACES / 示意动态', 830, 215, 24, '#b4baaf');
  for (let row = 0; row < 3; row++) {
    const y = 294 + row * 136;
    text(names[row], 830, y, 31);
    text('LOCAL VERIFIED', 1540, y, 24, colors[row]);
    for (let i = 0; i < 49; i++) {
      const amplitude = 20 + 43 * (.5 + .5 * Math.sin(i * .51 + row * 1.7 + time * 2));
      data.fillStyle = i / 49 < p ? colors[row] : '#30382d';
      data.fillRect(830 + i * 19, y + 27 + (65 - amplitude) / 2, 10, amplitude);
    }
  }
}

// Every frame is a pure function of film time, including the 3D object and data reveals.
window.seekFilm = seconds => {
  const t = Math.max(0, Math.min(29.999, seconds));
  const index = Math.floor(t / 5), local = t - index * 5;
  const light = index === 3 || index === 5;
  const bg = index === 5 ? lime : light ? paper : ink;
  stage.style.background = bg;
  stage.style.color = light ? ink : paper;
  for (const beat of beats) beat.style.visibility = Number(beat.dataset.index) === index ? 'visible' : 'hidden';
  const content = beats[index].querySelector('.content');
  const entrance = ease((local - .08) / .68);
  content.style.opacity = .2 + .8 * entrance;
  content.style.transform = index === 1 ? `scale(${.92 + .08 * entrance})` : index === 3 ? `translateX(${(1 - entrance) * -45}px)` : `translateY(${(1 - entrance) * 44}px)`;
  content.style.transformOrigin = 'left center';
  document.querySelector('#count').textContent = `0${index + 1} / 06`;
  document.querySelector('#chapter').textContent = labels[index];
  document.querySelector('#progress').style.transform = `scaleX(${t / 30})`;
  const wipe = document.querySelector('#wipe');
  wipe.style.transform = local > 4.7 && index < 5 ? `translateX(${100 - ((local - 4.7) / .3) * 200}%)` : 'translateX(100%)';
  data.clearRect(0, 0, 1920, 1080);
  sculpture.visible = [0,1,5].includes(index);
  sculpture.position.set(index === 5 ? 3.25 : 3.5, .1, 0);
  sculpture.rotation.set(.18, -.5 + Math.sin(t * .21) * .18, -.17);
  sculpture.scale.setScalar(index === 1 ? .91 : 1.04);
  for (let i = 0; i < slabs.length; i++) {
    const centered = i - 18.5;
    const spread = index === 1 ? lerp(.105, .14, ease(local / 2)) : .108;
    slabs[i].position.set(Math.sin(i * .1 + t * .2) * .1, centered * spread, 0);
    slabs[i].rotation.y = centered * .036 + Math.sin(t * .25) * .18;
    slabs[i].material.color.setHex(index === 5 ? (i % 7 === 0 ? 0xf2f4ed : 0x253c2d) : (i % 7 === 0 ? 0xd6fa8b : 0x253c2d));
  }
  if (index === 0 || index === 1 || index === 5) text(index === 1 ? 'ADAPTER / BASE MODEL' : 'LOCAL MODEL FABRIC', 1180, 935, 25, light ? ink : '#b4baaf');
  if (index === 2) drawCurve(local);
  if (index === 3) drawSamples(local);
  if (index === 4) drawRuntime(local, t);
  renderer.render(scene, camera);
  window.filmState = { seconds: t, index, webgl: !!renderer.getContext(), activeBeat: beats[index].className, checkpointPoints };
};
await document.fonts.ready;
window.seekFilm(1.7);
window.filmReady = true;
if (!new URLSearchParams(location.search).has('render')) {
  let start = performance.now();
  const animate = now => { window.seekFilm(((now - start) / 1000) % 30); requestAnimationFrame(animate); };
  requestAnimationFrame(animate);
  addEventListener('click', () => { start = performance.now(); });
}
