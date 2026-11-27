import * as THREE from 'three';
import { TERRA, BRASIL } from './terra.js';

/* =========================================================
   CONFIG
   ========================================================= */
const WHATSAPP = '5511945645253';
const WHATS_MSG = 'Olá, gostaria de saber mais sobre a Lumnis.';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData);
let isMobile = matchMedia('(max-width: 860px)').matches;
if (reduceMotion) document.documentElement.classList.add('reduce');

document.getElementById('ano').textContent = new Date().getFullYear();

/* ---------- WhatsApp: todo [data-whats] abre a conversa ---------- */
document.querySelectorAll('[data-whats]').forEach(a => {
  const msg = a.dataset.msg || WHATS_MSG;
  a.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  a.target = '_blank';
  a.rel = 'noopener';
});

/* ---------- faixas de logos: duplica o conteúdo para o loop não ter emenda ---------- */
document.querySelectorAll('.marquee__track').forEach(t => {
  [...t.children].forEach(n => { const c = n.cloneNode(true); c.alt = ''; c.setAttribute('aria-hidden', 'true'); t.appendChild(c); });
});

/* ---------- menu ---------- */
const nav = document.querySelector('.nav'), menuBtn = document.querySelector('.nav__menu');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuBtn.setAttribute('aria-expanded', open);
});
document.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false');
}));

/* ---------- FAQ: um aberto por vez, com animação ---------- */
document.querySelectorAll('.faq__item').forEach(item => {
  const sum = item.querySelector('summary'), body = item.querySelector('.faq__a');
  sum.addEventListener('click', e => {
    e.preventDefault();
    if (!item.open) {
      document.querySelectorAll('.faq__item[open]').forEach(o => { if (o !== item) o.open = false; });
      item.open = true;
      if (!reduceMotion) body.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else item.open = false;
  });
});

/* =========================================================
   GLOBO 3D
   ========================================================= */
const R = 5;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const deg = Math.PI / 180;

function ll(lat, lon, r = R) {
  const phi = (90 - lat) * deg, th = (lon + 180) * deg;
  return V(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

const canvas = document.getElementById('globo');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, alpha: false, powerPreference: 'high-performance' });
} catch (e) {
  canvas.style.display = 'none';
  document.querySelectorAll('.chapter').forEach(c => c.classList.add('is-active'));
  document.body.style.background = "#000224 url('assets/original/worldlumnis.webp') center 20% / min(900px, 120vw) no-repeat fixed";
}

if (renderer) {
  const PIX = Math.min(devicePixelRatio || 1, lowEnd ? 1 : 1.75);
  renderer.setPixelRatio(PIX);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000224, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 400);
  camera.position.set(0, 0, 16);

  const globe = new THREE.Group();
  globe.rotation.order = 'XYZ';
  scene.add(globe);

  /* ---------- núcleo escuro com borda azul ---------- */
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R * .985, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uA: { value: new THREE.Color(0x020830) }, uB: { value: new THREE.Color(0x1183d9) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1. - max(dot(vN, vV), 0.), 3.); gl_FragColor = vec4(mix(uA, uB, f*.55), 1.); }`
    })
  );
  globe.add(core);

  /* ---------- atmosfera ---------- */
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.2, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(0x2a9be8) }, uK: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vV;
        void main(){ float i = pow(clamp(.72 + dot(vN, vV), 0., 1.), 5.); gl_FragColor = vec4(uC, i*.9*uK); }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    })
  );
  scene.add(atmo);

  /* ---------- continentes em pontos ---------- */
  const parse = s => s.split(';').map(p => p.split(',').map(Number));
  const land = parse(TERRA), br = parse(BRASIL);
  const nPts = land.length + br.length;
  const pos = new Float32Array(nPts * 3), col = new Float32Array(nPts * 3), isBr = new Float32Array(nPts);
  const cLand = new THREE.Color(0x4f7ae0), cTeal = new THREE.Color(0x49c7c3), cViolet = new THREE.Color(0x8834d5), tmp = new THREE.Color();
  [...land, ...br].forEach(([la, lo], i) => {
    const v = ll(la, lo, R * 1.003);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = i >= land.length;
    if (b) tmp.copy(cTeal).lerp(cViolet, clamp((-la - 2) / 30, 0, 1));
    else tmp.copy(cLand).lerp(cViolet, Math.random() * .25);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
    isBr[i] = b ? 1 : 0;
  });
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  dotGeo.setAttribute('aBr', new THREE.BufferAttribute(isBr, 1));
  const dotMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBr: { value: .5 }, uPix: { value: PIX }, uDim: { value: 1 } },
    vertexShader: `attribute vec3 color; attribute float aBr; uniform float uTime, uBr, uPix, uDim;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix*vec4(position,1.);
        gl_Position = projectionMatrix*mv;
        vec3 n = normalize((modelViewMatrix*vec4(position,0.)).xyz);
        float face = smoothstep(-.05, .45, n.z);
        float tw = .75 + .25*sin(uTime*2.2 + position.x*4. + position.y*3.);
        float s = mix(3.0, 3.2 + 2.0*uBr*tw, aBr);
        gl_PointSize = max(2., s * uPix * (15. / -mv.z));
        vC = mix(color*1.35, color*(1.1 + 1.1*uBr*tw), aBr);
        vA = face * mix(.9, 1., aBr) * uDim;
      }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vC, smoothstep(.5, .32, d)*vA); }`,
    transparent: true, depthWrite: false
  });
  globe.add(new THREE.Points(dotGeo, dotMat));

  /* ---------- arcos: capital do mundo chegando ao Brasil ---------- */
  const ORIG = [[40.7, -74], [51.5, -.1], [50.1, 8.7], [47.4, 8.5], [48.9, 2.35], [25.2, 55.3], [35.7, 139.7], [1.35, 103.8], [22.3, 114.2], [43.7, -79.4], [25.8, -80.2], [40.4, -3.7], [38.7, -9.1], [41.9, 12.5], [-33.9, 151.2]];
  const DEST = [[-23.55, -46.63], [-22.9, -43.2], [-15.8, -47.9], [-19.9, -43.9], [-25.4, -49.3], [-30, -51.2], [-8.05, -34.9], [-3.1, -60], [-16.7, -49.3], [-12.97, -38.5]];
  const SEG = 72, arcs = [];
  ORIG.forEach((o, i) => {
    arcs.push({ o, d: DEST[i % DEST.length] });
    if (i % 2 === 0) arcs.push({ o, d: DEST[(i * 3 + 1) % DEST.length] });
  });
  const arcPos = [], arcT = [], arcOff = [];
  arcs.forEach((a, k) => {
    const A = ll(...a.o).normalize(), B = ll(...a.d).normalize();
    const om = Math.acos(clamp(A.dot(B), -1, 1)), so = Math.sin(om);
    const h = .08 + .38 * om / Math.PI;
    a.pts = [];
    for (let j = 0; j <= SEG; j++) {
      const t = j / SEG;
      const p = A.clone().multiplyScalar(Math.sin((1 - t) * om) / so).add(B.clone().multiplyScalar(Math.sin(t * om) / so));
      a.pts.push(p.normalize().multiplyScalar(R * (1.005 + h * Math.sin(Math.PI * t))));
    }
    a.off = Math.random();
    a.speed = .55 + Math.random() * .4;
    for (let j = 0; j < SEG; j++) {
      const p = a.pts[j], q = a.pts[j + 1];
      arcPos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      arcT.push(j / SEG, (j + 1) / SEG);
      arcOff.push(a.off, a.off);
    }
    a.speedAttr = a.speed;
  });
  const arcSpeed = [];
  arcs.forEach(a => { for (let j = 0; j < SEG * 2; j++) arcSpeed.push(a.speed); });
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPos, 3));
  arcGeo.setAttribute('aT', new THREE.Float32BufferAttribute(arcT, 1));
  arcGeo.setAttribute('aOff', new THREE.Float32BufferAttribute(arcOff, 1));
  arcGeo.setAttribute('aSp', new THREE.Float32BufferAttribute(arcSpeed, 1));
  const arcMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uA: { value: new THREE.Color(0x8834d5) }, uB: { value: new THREE.Color(0x49c7c3) } },
    vertexShader: `attribute float aT, aOff, aSp; varying float vT, vO, vS, vF;
      void main(){ vT = aT; vO = aOff; vS = aSp; vec4 mv = modelViewMatrix*vec4(position,1.);
        vec3 n = normalize((modelViewMatrix*vec4(position,0.)).xyz); vF = smoothstep(-.35, .25, n.z);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime, uK; uniform vec3 uA, uB; varying float vT, vO, vS, vF;
      void main(){
        float x = fract(uTime*.16*vS + vO) * 1.3;
        float d = vT - x;
        float tail = d < 0. ? pow(max(0., 1. + d/.32), 2.5) : 0.;
        float a = (.07 + tail) * uK * vF;
        gl_FragColor = vec4(mix(uA, uB, vT) * (1. + tail), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  globe.add(new THREE.LineSegments(arcGeo, arcMat));

  /* cabeças luminosas que percorrem os arcos + pulsos nas cidades brasileiras */
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const headPos = new Float32Array(arcs.length * 3);
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
  const headMat = new THREE.PointsMaterial({ map: sprite, color: 0xff4fa0, size: .32, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.Points(headGeo, headMat));

  const cityGeo = new THREE.BufferGeometry().setFromPoints(DEST.map(d => ll(...d, R * 1.01)));
  const cityMat = new THREE.PointsMaterial({ map: sprite, color: 0x7ff3ee, size: .5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.Points(cityGeo, cityMat));

  /* ---------- estrelas ---------- */
  const nStars = lowEnd ? 900 : 2200, sp = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(70 + Math.random() * 90);
    sp.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa8c4ff, size: .28, sizeAttenuation: true, transparent: true, opacity: .7, depthWrite: false }));
  scene.add(stars);

  /* ---------- aurora atrás do globo ---------- */
  const auroraTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(73,199,195,.55)'); gr.addColorStop(.35, 'rgba(17,131,217,.35)');
    gr.addColorStop(.65, 'rgba(136,52,213,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const aurora = new THREE.Sprite(new THREE.SpriteMaterial({ map: auroraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 }));
  aurora.scale.setScalar(R * 5.2);
  aurora.position.z = -R * 1.5;
  scene.add(aurora);

  /* ---------- anéis de órbita ---------- */
  const rings = new THREE.Group();
  scene.add(rings);
  const ringMat = (c1, c2) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(c1) }, uB: { value: new THREE.Color(c2) }, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime, uK; uniform vec3 uA, uB; varying vec2 vUv;
      void main(){ float a = fract(vUv.x - uTime*.05); float g = pow(a, 3.); gl_FragColor = vec4(mix(uA, uB, a), (.1 + g*.9)*uK); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const RINGS = [
    { r: R * 1.32, tilt: [1.25, .2, .35], speed: .12, c: [0x1183d9, 0x49c7c3] },
    { r: R * 1.55, tilt: [1.05, -.5, -.2], speed: -.08, c: [0x8834d5, 0xff1177] },
    { r: R * 1.8, tilt: [1.45, .6, .1], speed: .05, c: [0x1183d9, 0x8834d5] },
  ].map(o => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(o.r, .012, 6, 220), ringMat(...o.c));
    const pivot = new THREE.Group(); pivot.rotation.set(...o.tilt); pivot.add(m); rings.add(pivot);
    // satélite que percorre o anel
    const sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: o.c[1], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sat.scale.setScalar(.45); pivot.add(sat);
    return { ...o, mesh: m, sat };
  });

  /* =========================================================
     ROTEIRO: cada seção tem um enquadramento do globo
     s = 0 hero | 1 mercado | 2..6 jornada | 7 formações
     ========================================================= */
  const chapters = [...document.querySelectorAll('.chapter')];
  const KEY_EL = [document.querySelector('#topo'), document.querySelector('#mercado'), ...chapters, document.querySelector('#formacoes')];
  //            lat,  lon,  x(desk), dist, arcos, brasil, dim
  const KF = [
    [-8, -38, 3.6, 16, .9, .45, 1],     // hero: Brasil + Atlântico
    [22, -30, 0, 21, 1.15, .4, .55],    // mercado: o fluxo do mundo
    [-14, -51, 3.2, 11, .25, .8, 1],    // 01 diagnóstico: zoom no Brasil
    [-18, -45, -3.2, 12, .35, .7, 1],   // 02 estruturação
    [32, -32, 3.4, 15.5, 1.4, .45, 1],  // 03 conexão: hemisfério norte
    [4, -38, -3.2, 14, 1.6, .7, 1],     // 04 desembolso: capital chegando
    [-14, -50, 3.0, 11.5, .9, 1.25, 1], // 05 resultado: Brasil aceso
    [-5, -30, 0, 25, .5, .5, .35],      // formações em diante: recua
  ];

  let keyScroll = [];
  function measure() {
    isMobile = matchMedia('(max-width: 860px)').matches;
    keyScroll = KEY_EL.map((el, i) => {
      if (i === 0) return 0;
      const r = el.getBoundingClientRect();
      if (i === KEY_EL.length - 1) return r.top + scrollY - innerHeight * .4;
      return r.top + scrollY + r.height / 2 - innerHeight / 2;
    });
  }
  measure();
  addEventListener('load', measure);
  new ResizeObserver(() => { measure(); if (window.__lenis) window.__lenis.resize(); }).observe(document.querySelector('main'));
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); measure();
  });

  function stageAt(y) {
    let i = 0;
    while (i < keyScroll.length - 2 && y > keyScroll[i + 1]) i++;
    const t = clamp((y - keyScroll[i]) / Math.max(1, keyScroll[i + 1] - keyScroll[i]), 0, 1);
    return i + t;
  }
  function frameAt(s) {
    const i = Math.min(Math.floor(s), KF.length - 2), t = smooth(s - i);
    return KF[i].map((v, k) => lerp(v, KF[i + 1][k], t));
  }

  /* HUD + capítulos ativos */
  const hud = document.querySelector('.hud'), hudNum = document.getElementById('hudNum'), hudName = document.getElementById('hudName'), hudFill = document.getElementById('hudFill');
  let lastIdx = -1;
  function updateHud(s) {
    hud.classList.toggle('is-on', s > 1.6 && s < 6.5);
    const idx = clamp(Math.round(s) - 2, 0, 4);
    if (idx !== lastIdx) {
      lastIdx = idx;
      hudNum.textContent = String(idx + 1).padStart(2, '0');
      hudName.textContent = chapters[idx].dataset.name;
    }
    chapters.forEach((c, k) => c.classList.toggle('is-active', Math.abs(s - (k + 2)) < .5));
    hudFill.style.height = `${clamp((s - 2) / 4, 0, 1) * 100}%`;
  }

  /* mouse */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; }, { passive: true });

  /* estado suavizado */
  const cur = frameAt(0).slice();
  const clock = new THREE.Clock();
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    const s = stageAt(scrollY);
    const tgt = frameAt(s);
    const k = reduceMotion ? 1 : 1 - Math.pow(.0015, dt);
    for (let i = 0; i < cur.length; i++) cur[i] = lerp(cur[i], tgt[i], k);
    const [lat, lon, xOff, dist, arcK, brK, dim] = cur;

    mouse.x = lerp(mouse.x, mouse.tx, .05); mouse.y = lerp(mouse.y, mouse.ty, .05);
    const drift = reduceMotion ? 0 : Math.sin(time * .12) * 4;

    // gira o globo para que (lat, lon) fique de frente para a câmera
    const v = ll(lat, lon + drift);
    const ry = Math.atan2(-v.x, v.z);
    globe.rotation.set(lat * deg + mouse.y * .12, ry + mouse.x * .2, 0);

    const mob = isMobile ? 1 : 0;
    const x = mob ? 0 : xOff;
    const y = mob ? (s < .5 ? 2.4 : 1.6) : 0;
    const d = dist + mob * 6;
    globe.position.set(x, y, 0);
    atmo.position.copy(globe.position);
    rings.position.copy(globe.position);
    aurora.position.x = globe.position.x; aurora.position.y = globe.position.y;
    aurora.material.opacity = (.55 + .2 * Math.sin(time * .6)) * dim;
    // anéis aparecem com força no hero e somem na jornada
    const ringK = clamp(1 - s * 1.2, 0, 1) * .9 + clamp(s - 6.2, 0, 1) * .3;
    RINGS.forEach((o, i) => {
      o.mesh.rotation.z = time * o.speed;
      o.mesh.material.uniforms.uTime.value = time;
      o.mesh.material.uniforms.uK.value = ringK;
      const a = time * (o.speed * 2.2) + i * 2;
      o.sat.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
      o.sat.material.opacity = ringK;
    });
    rings.visible = ringK > .01;
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);

    atmo.material.uniforms.uK.value = dim;
    dotMat.uniforms.uTime.value = time;
    dotMat.uniforms.uBr.value = brK;
    dotMat.uniforms.uDim.value = dim;
    arcMat.uniforms.uTime.value = time;
    arcMat.uniforms.uK.value = arcK * dim;
    headMat.opacity = clamp(arcK, 0, 1) * dim;
    cityMat.size = .42 + .14 * Math.sin(time * 3) + brK * .15;
    cityMat.opacity = dim;

    arcs.forEach((a, i) => {
      const x = fract(time * .16 * a.speed + a.off) * 1.3;
      const p = a.pts[Math.min(SEG, Math.round(Math.min(x, 1) * SEG))];
      const out = x > 1 ? 1e3 : 0; // some depois de chegar
      headPos[i * 3] = p.x + out; headPos[i * 3 + 1] = p.y; headPos[i * 3 + 2] = p.z;
    });
    headGeo.attributes.position.needsUpdate = true;

    stars.rotation.y = time * .006;
    updateHud(s);
    renderer.render(scene, camera);
  }
  const fract = x => x - Math.floor(x);
  tick();
}

/* =========================================================
   SCROLL SUAVE + TEXTOS
   ========================================================= */
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

if (window.Lenis && !reduceMotion) {
  const lenis = new Lenis({ lerp: .09, smoothWheel: true });
  window.__lenis = lenis;
  document.querySelectorAll('a[href^="#"]:not([data-whats])').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const el = document.querySelector(id); if (!el) return;
    e.preventDefault(); lenis.scrollTo(el, { offset: -70 });
  }));
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
}

if (window.gsap && window.ScrollTrigger && !reduceMotion) {
  gsap.registerPlugin(ScrollTrigger);
  // entrada do hero
  gsap.from('.hero__title .line > span', { yPercent: 110, duration: 1.2, ease: 'power4.out', stagger: .12, delay: .15 });
  gsap.from(['.hero .eyebrow', '.hero__sub', '.hero__ctas', '.hero__facts li'], { y: 24, opacity: 0, duration: 1, ease: 'power3.out', stagger: .08, delay: .5 });
  // revelação das seções
  gsap.utils.toArray('.reveal').forEach(el => {
    gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  // contadores
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), o = { v: 0 };
    gsap.to(o, { v: end, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => { el.textContent = o.v.toFixed(dec).replace('.', ','); } });
  });
} else {
  document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
}

// barras do comparativo
const cmp = document.querySelector('.compare');
new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { cmp.classList.add('is-in'); io.disconnect(); } }), { threshold: .4 }).observe(cmp);
