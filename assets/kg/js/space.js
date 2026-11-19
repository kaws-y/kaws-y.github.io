/* Knowledge Garden · light spatial scene for the home hero (Three.js, loaded on demand) */
import * as THREE from '../vendor/three.module.min.js';

const PALETTE = {
  light: {
    pearl: 0xe4ecfb, slab: 0xffffff, ring: 0x9fb6e6, violet: 0xb9aef0, peach: 0xffd3ba, teal: 0xa9dde6,
    particle: 0x8fa9dc, particleOpacity: 0.7, exposure: 1.02, env: 1.0, key: 1.7, fill: 0.95, slabOpacity: 0.34
  },
  dark: {
    pearl: 0x5d76b4, slab: 0x9db4e8, ring: 0x6f8fd0, violet: 0x7868c4, peach: 0xb9806a, teal: 0x4f9aa8,
    particle: 0xbcd0ff, particleOpacity: 0.85, exposure: 0.9, env: 0.5, key: 1.1, fill: 0.35, slabOpacity: 0.16
  }
};

function gradientTexture(stops, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dotTexture() {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

// A tiny procedural studio (soft sky + three light panels) baked into an environment map.
function buildEnvironment(renderer) {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      map: gradientTexture([[0, '#ffffff'], [0.42, '#e9f0fc'], [0.7, '#cfdaf3'], [1, '#b9c3e6']], 16, 256)
    })
  );
  scene.add(sky);
  const panel = (color, intensity, w, h, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(0xffffff, 9, 10, 6, [-7, 9, 6]);
  panel(0xdfe6ff, 5, 6, 8, [10, 2, 4]);
  panel(0xffe6d6, 3.5, 8, 3, [0, -8, 6]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  return env;
}

function slabGeometry(w, h, r, depth) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 10 });
  geo.center();
  return geo;
}

export function mount(host, options = {}) {
  const lite = !!options.lite;
  const reduceMotion = !!options.reduceMotion;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !lite, powerPreference: 'default' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  let dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 0, 15);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcdd8f0, 0.95);
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-5, 8, 7);
  const rim = new THREE.PointLight(0xb7a9ff, 22, 30, 2);
  rim.position.set(6, -3, 4);
  scene.add(hemi, key, rim);

  const rig = new THREE.Group();     // everything that reacts to the pointer
  const cluster = new THREE.Group(); // the composition itself
  rig.add(cluster);
  scene.add(rig);

  const mats = {
    pearl: new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.22, iridescence: 0.45, iridescenceIOR: 1.3, sheen: 0.4, sheenColor: new THREE.Color(0xc9b8ff) }),
    slab: new THREE.MeshPhysicalMaterial({ roughness: 0.08, metalness: 0, transparent: true, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    ring: new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.85 }),
    violet: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.3 }),
    peach: new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
    teal: new THREE.MeshPhysicalMaterial({ roughness: 0.16, clearcoat: 1, flatShading: true })
  };

  const floaters = [];
  const add = (mesh, pos, opts = {}) => {
    mesh.position.set(pos[0], pos[1], pos[2]);
    cluster.add(mesh);
    floaters.push(Object.assign({ mesh, base: mesh.position.clone(), amp: 0.18, speed: 0.5, phase: Math.random() * 6.28, spin: [0, 0, 0] }, opts));
    return mesh;
  };

  const seg = lite ? 40 : 72;
  add(new THREE.Mesh(new THREE.SphereGeometry(2.05, seg, seg), mats.pearl), [0, 0.1, 0], { amp: 0.14, speed: 0.32, spin: [0, 0.05, 0] });

  const ringA = add(new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.022, 12, 180), mats.ring), [0, 0.1, 0], { amp: 0.14, speed: 0.32, spin: [0, 0, 0.06] });
  ringA.rotation.set(1.25, 0.28, 0);
  const ringB = add(new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.012, 10, 200), mats.ring), [0, 0.1, 0], { amp: 0.14, speed: 0.32, spin: [0, 0, -0.035] });
  ringB.rotation.set(1.05, -0.5, 0.4);

  const slabA = add(new THREE.Mesh(slabGeometry(2.7, 1.75, 0.3, 0.05), mats.slab), [-2.5, 1.5, 1.7], { amp: 0.22, speed: 0.42, spin: [0, 0.02, 0] });
  slabA.rotation.set(-0.12, 0.5, -0.1);
  const slabB = add(new THREE.Mesh(slabGeometry(1.9, 2.5, 0.28, 0.05), mats.slab), [2.75, -1.25, 1.2], { amp: 0.2, speed: 0.36, spin: [0, -0.025, 0] });
  slabB.rotation.set(0.1, -0.55, 0.08);
  const slabC = add(new THREE.Mesh(slabGeometry(1.35, 0.9, 0.2, 0.04), mats.slab), [1.9, 2.35, -1.6], { amp: 0.26, speed: 0.5 });
  slabC.rotation.set(0.2, -0.3, 0.16);

  add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 40), mats.peach), [2.7, 1.55, 1.9], { amp: 0.3, speed: 0.62 });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), mats.violet), [-2.95, -1.45, 1.1], { amp: 0.34, speed: 0.7 });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), mats.violet), [-1.1, 2.75, 0.4], { amp: 0.3, speed: 0.9 });
  add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mats.teal), [-1.75, -2.35, 2.3], { amp: 0.28, speed: 0.55, spin: [0.14, 0.2, 0.06] });
  add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mats.teal), [3.55, 0.35, -0.8], { amp: 0.3, speed: 0.8, spin: [0.2, 0.12, 0.1] });

  // A small field of drifting particles
  const count = lite ? 70 : 150;
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3.4 + Math.random() * 6.5, a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI * 0.9;
    posArr[i * 3] = Math.cos(a) * Math.cos(b) * r * 1.35;
    posArr[i * 3 + 1] = Math.sin(b) * r * 0.8;
    posArr[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r - 1.5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.11, map: dotTexture(), transparent: true, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  rig.add(particles);

  function applyTheme(theme) {
    const p = PALETTE[theme === 'dark' ? 'dark' : 'light'];
    mats.pearl.color.setHex(p.pearl);
    mats.slab.color.setHex(p.slab); mats.slab.opacity = p.slabOpacity;
    mats.ring.color.setHex(p.ring);
    mats.violet.color.setHex(p.violet);
    mats.peach.color.setHex(p.peach);
    mats.teal.color.setHex(p.teal);
    pMat.color.setHex(p.particle); pMat.opacity = p.particleOpacity;
    Object.values(mats).forEach((m) => { m.envMapIntensity = p.env; });
    key.intensity = p.key; hemi.intensity = p.fill;
    renderer.toneMappingExposure = p.exposure;
    requestRender();
  }

  // Layout: the composition sits right of the copy on wide screens, behind it on narrow ones.
  let width = 0, height = 0;
  function layout() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const visW = visH * camera.aspect;
    if (camera.aspect > 1.15) {
      const s = Math.min(1, visW / 17);
      cluster.scale.setScalar(s);
      cluster.position.set(visW * 0.235, 0.15, 0);
    } else {
      const s = Math.min(0.78, visW / 9.5);
      cluster.scale.setScalar(s);
      cluster.position.set(visW * 0.2, visH * 0.2, -1);
    }
    requestRender();
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointer(e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }
  if (!reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  let running = false, visible = true, raf = 0, last = 0, t = 0, disposed = false;
  let slowFrames = 0, frames = 0;

  function frame(now) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;

    // Adapt resolution once if the device struggles
    if (frames < 90) {
      frames++;
      if (dt > 0.034) slowFrames++;
      if (frames === 90 && slowFrames > 45 && dpr > 1) { dpr = 1; renderer.setPixelRatio(1); renderer.setSize(width, height, false); }
    }

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    rig.rotation.y = pointer.x * 0.22;
    rig.rotation.x = pointer.y * 0.12;
    const scroll = Math.min(1, window.pageYOffset / Math.max(1, height));
    rig.position.y = scroll * 1.6;
    cluster.rotation.y = Math.sin(t * 0.11) * 0.22;

    for (let i = 0; i < floaters.length; i++) {
      const f = floaters[i];
      f.mesh.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.amp;
      f.mesh.position.x = f.base.x + Math.cos(t * f.speed * 0.7 + f.phase) * f.amp * 0.4;
      f.mesh.rotation.x += f.spin[0] * dt;
      f.mesh.rotation.y += f.spin[1] * dt;
      f.mesh.rotation.z += f.spin[2] * dt;
    }
    particles.rotation.y = t * 0.012;
    particles.position.y = Math.sin(t * 0.2) * 0.15;

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }
  function setRunning(on) {
    const next = on && visible && !document.hidden && !reduceMotion;
    if (next === running) return;
    running = next;
    if (running) { last = performance.now(); requestRender(); }
  }

  const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
  if (ro) ro.observe(host); else window.addEventListener('resize', layout);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => { visible = en[0].isIntersecting; setRunning(true); }, { threshold: 0.02 }) : null;
  if (io) io.observe(host);
  const onVis = () => setRunning(true);
  document.addEventListener('visibilitychange', onVis);
  const onTheme = (e) => applyTheme(e.detail.theme);
  document.addEventListener('kg:theme', onTheme);

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    host.classList.remove('is-live');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    host.classList.add('is-live');
    setRunning(true);
    requestRender();
  });

  layout();
  applyTheme(options.theme);
  setRunning(true);
  requestRender();

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('kg:theme', onTheme);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
