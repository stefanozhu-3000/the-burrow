import "./styles.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const smootherstep = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const story = document.querySelector(".story");
const sceneElement = document.querySelector(".scene");
const canvas = document.querySelector("#burrow-canvas");
const modelWrap = document.querySelector(".model-wrap");
const loaderElement = document.querySelector(".model-loader");
const loaderBar = document.querySelector(".loader-track i");
const loaderCopy = document.querySelector(".loader-copy");
const modelError = document.querySelector(".model-error");
const headline = document.querySelector("#hero-title");
const propButtons = [...document.querySelectorAll(".flying-prop")];
const propTooltip = document.querySelector(".prop-tooltip");
const tooltipTitle = propTooltip.querySelector("strong");
const tooltipStory = propTooltip.querySelector("p");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const headlineLabel = headline.textContent.trim();
const headlineLetters = [];
headline.setAttribute("aria-label", headlineLabel);
headline.textContent = "";
headlineLabel.split(/\s+/).forEach((word, wordIndex, words) => {
  const wordElement = document.createElement("span");
  wordElement.className = "headline-word";
  wordElement.setAttribute("aria-hidden", "true");

  [...word].forEach((character) => {
    const letter = document.createElement("span");
    letter.className = "headline-letter";
    letter.textContent = character;
    wordElement.append(letter);
    headlineLetters.push(letter);
  });

  headline.append(wordElement);
  if (wordIndex < words.length - 1) headline.append(" ");
});

const MODEL_HEIGHT = 3.12;
const MODEL_FLOOR_Y = -1.76;
const MODEL_BOTTOM_NDC = -0.89;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));

const threeScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const modelPivot = new THREE.Group();
threeScene.add(modelPivot);

const hemisphere = new THREE.HemisphereLight(0x7690a9, 0x2e1b0f, 1.65);
threeScene.add(hemisphere);

const sunsetKey = new THREE.DirectionalLight(0xffbb72, 4.8);
sunsetKey.position.set(4.8, 4.6, 5.5);
threeScene.add(sunsetKey);

const moonFill = new THREE.DirectionalLight(0x6c8cae, 2.2);
moonFill.position.set(-4.5, 3, 2.4);
threeScene.add(moonFill);

const windowGlow = new THREE.PointLight(0xff802e, 2.8, 9, 1.65);
windowGlow.position.set(0.4, -0.4, 2.8);
threeScene.add(windowGlow);

function createGlowTexture() {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 64;
  glowCanvas.height = 64;
  const context = glowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 250, 218, 1)");
  gradient.addColorStop(0.12, "rgba(255, 220, 133, 1)");
  gradient.addColorStop(0.38, "rgba(255, 168, 54, 0.52)");
  gradient.addColorStop(1, "rgba(255, 135, 24, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(glowCanvas);
}

const magicTrailGroup = new THREE.Group();
const magicTrailPositions = [];
const magicTrailPointCount = 260;
const magicTrailBuffer = new Float32Array(magicTrailPointCount * 3);

for (let index = 0; index < magicTrailPointCount; index += 1) {
  const amount = index / (magicTrailPointCount - 1);
  const angle = -Math.PI * 0.62 + amount * Math.PI * 2.32;
  const radius = mix(1.22, 0.76, amount);
  const point = new THREE.Vector3(
    Math.cos(angle) * radius,
    mix(-1.5, 1.22, amount),
    Math.sin(angle) * radius,
  );
  magicTrailPositions.push(point);
  magicTrailBuffer[index * 3] = point.x;
  magicTrailBuffer[index * 3 + 1] = point.y;
  magicTrailBuffer[index * 3 + 2] = point.z;
}

const magicTrailGeometry = new THREE.BufferGeometry();
magicTrailGeometry.setAttribute("position", new THREE.BufferAttribute(magicTrailBuffer, 3));
magicTrailGeometry.setDrawRange(0, 2);

const magicTrailMaterial = new THREE.LineBasicMaterial({
  color: 0xffc362,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
});
magicTrailMaterial.toneMapped = false;

const magicTrailLine = new THREE.Line(magicTrailGeometry, magicTrailMaterial);
magicTrailGroup.add(magicTrailLine);

const glowTexture = createGlowTexture();
const magicSparkMaterial = new THREE.PointsMaterial({
  color: 0xffd27c,
  map: glowTexture,
  size: 0.085,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0,
  alphaTest: 0.01,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
});
magicSparkMaterial.toneMapped = false;

const magicSparks = new THREE.Points(magicTrailGeometry, magicSparkMaterial);
magicTrailGroup.add(magicSparks);

const magicHeadMaterial = new THREE.SpriteMaterial({
  color: 0xffe1a0,
  map: glowTexture,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
});
magicHeadMaterial.toneMapped = false;

const magicTrailHead = new THREE.Sprite(magicHeadMaterial);
magicTrailHead.scale.setScalar(0.2);
magicTrailGroup.add(magicTrailHead);
magicTrailGroup.visible = false;
modelPivot.add(magicTrailGroup);

let burrowModel = null;
let rawScrollProgress = 0;
let scrollProgress = 0;
let pointerX = 0;
let pointerY = 0;
let modelYaw = 0;
let modelPitch = 0;
let lastFrame = performance.now();

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

gltfLoader.load(
  "/burrow-v2.glb",
  (gltf) => {
    burrowModel = gltf.scene;
    burrowModel.traverse((child) => {
      if (!child.isMesh) return;
      child.frustumCulled = true;
      if (child.material) {
        child.material.envMapIntensity = 0.48;
        child.material.needsUpdate = true;
      }
    });

    burrowModel.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(burrowModel);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const scale = MODEL_HEIGHT / Math.max(initialSize.y, 0.001);
    burrowModel.scale.setScalar(scale);
    burrowModel.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(burrowModel);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    burrowModel.position.set(-scaledCenter.x, -scaledBox.min.y + MODEL_FLOOR_Y, -scaledCenter.z);
    modelPivot.add(burrowModel);

    loaderElement.classList.add("is-hidden");
    sceneElement.classList.add("model-ready");
  },
  (event) => {
    if (!event.total) {
      loaderCopy.textContent = "The magic is gathering…";
      return;
    }
    const percent = clamp(event.loaded / event.total);
    loaderBar.style.width = `${Math.max(5, percent * 100)}%`;
    loaderCopy.textContent = percent > 0.93 ? "Lighting the windows…" : "Summoning The Burrow…";
  },
  (error) => {
    console.error("Could not load The Burrow model", error);
    loaderElement.classList.add("is-hidden");
    modelError.hidden = false;
  },
);

function updateScrollTarget() {
  const travel = Math.max(story.offsetHeight - window.innerHeight, 1);
  rawScrollProgress = clamp(window.scrollY / travel);
}

function updateResponsiveCamera() {
  const rect = modelWrap.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const viewportAspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const framing = smoothstep(0.58, 1.6, viewportAspect);
  const cameraDistance = mix(7.5, 6.65, framing);
  const projectionHalfHeight = cameraDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const cameraTargetY = MODEL_FLOOR_Y - MODEL_BOTTOM_NDC * projectionHalfHeight;
  camera.aspect = width / height;
  camera.position.set(0, cameraTargetY, cameraDistance);
  camera.lookAt(0, cameraTargetY, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.4 : 1.7));
}

function setFeatheredReveal(name, amount) {
  const finish = smoothstep(0.88, 1, amount);
  const feather = mix(18, 0, finish);
  const leadingSoftness = mix(2, 0, finish);
  sceneElement.style.setProperty(`--${name}-reveal-start`, `${Math.max(0, amount * 100 - feather)}%`);
  sceneElement.style.setProperty(`--${name}-reveal-end`, `${Math.min(100, amount * 100 + leadingSoftness)}%`);
}

function updateLayerVariables(progress) {
  const carIn = smootherstep(0.045, 0.35, progress);
  const letterIn = smootherstep(0.255, 0.61, progress);
  const owlIn = smootherstep(0.49, 0.87, progress);
  const gentle = smoothstep(0.08, 0.92, progress);

  sceneElement.style.setProperty("--bg-shift", `${progress * -3.2}vh`);
  sceneElement.style.setProperty("--fg-shift", `${1.2 - progress * 1.6}vh`);
  sceneElement.style.setProperty("--fg-scale", (1.04 + progress * 0.045).toFixed(4));
  const decorationOut = smoothstep(0.055, 0.24, progress);
  sceneElement.style.setProperty("--headline-decor-shift", `${decorationOut * -2.4}vh`);
  sceneElement.style.setProperty("--headline-decor-opacity", (1 - decorationOut).toFixed(4));
  sceneElement.style.setProperty("--model-shift", `${gentle * -1.1}vh`);
  sceneElement.style.setProperty("--model-scale", (1 - gentle * 0.018).toFixed(4));
  sceneElement.style.setProperty("--scroll-cue-opacity", clamp(1 - progress * 4).toFixed(4));
  sceneElement.style.setProperty("--progress-height", `${progress * 100}%`);

  headlineLetters.forEach((letter, index) => {
    const delay = prefersReducedMotion.matches ? 0 : index * 0.012;
    const letterOut = smoothstep(0.025 + delay, 0.14 + delay, progress);
    letter.style.setProperty("--letter-shift", `${letterOut * -1.08}em`);
    letter.style.setProperty("--letter-opacity", (1 - letterOut).toFixed(4));
    letter.style.setProperty("--letter-blur", `${letterOut * 3.5}px`);
  });

  sceneElement.style.setProperty("--car-x", `${mix(20, 0.25, carIn)}vw`);
  sceneElement.style.setProperty("--car-y", `${mix(4.5, -0.25, carIn) - Math.sin(carIn * Math.PI) * 1.8}vh`);
  sceneElement.style.setProperty("--car-rotate", `${mix(4, 0.6, carIn)}deg`);
  sceneElement.style.setProperty("--car-scale", mix(0.94, 1, carIn).toFixed(4));
  sceneElement.style.setProperty("--car-opacity", carIn.toFixed(4));
  setFeatheredReveal("car", carIn);

  sceneElement.style.setProperty("--letter-x", `${mix(15, 0, letterIn)}vw`);
  sceneElement.style.setProperty("--letter-y", `${mix(5, -0.15, letterIn) - Math.sin(letterIn * Math.PI) * 2.2}vh`);
  sceneElement.style.setProperty("--letter-rotate", `${mix(5, 0.8, letterIn)}deg`);
  sceneElement.style.setProperty("--letter-scale", mix(0.93, 1, letterIn).toFixed(4));
  sceneElement.style.setProperty("--letter-opacity", letterIn.toFixed(4));
  setFeatheredReveal("letter", letterIn);

  sceneElement.style.setProperty("--owl-x", `${mix(-19, -0.2, owlIn)}vw`);
  sceneElement.style.setProperty("--owl-y", `${mix(5, 0.2, owlIn) - Math.sin(owlIn * Math.PI) * 1.7}vh`);
  sceneElement.style.setProperty("--owl-rotate", `${mix(-5, -0.6, owlIn)}deg`);
  sceneElement.style.setProperty("--owl-scale", mix(0.94, 1, owlIn).toFixed(4));
  sceneElement.style.setProperty("--owl-opacity", owlIn.toFixed(4));
  setFeatheredReveal("owl", owlIn);

  [carIn, letterIn, owlIn].forEach((amount, index) => {
    const element = propButtons[index];
    const interactive = amount > 0.88;
    if (element.dataset.interactive === String(interactive)) return;
    element.dataset.interactive = String(interactive);
    element.classList.toggle("is-interactive", interactive);
    element.tabIndex = interactive ? 0 : -1;
    element.setAttribute("aria-hidden", String(!interactive));
    if (!interactive && document.activeElement === element) element.blur();
  });
}

function positionTooltip(clientX, clientY) {
  const gap = 18;
  const edge = 14;
  const width = propTooltip.offsetWidth || 290;
  const height = propTooltip.offsetHeight || 150;
  let left = clientX + gap;
  let top = clientY + gap;

  if (left + width > window.innerWidth - edge) left = clientX - width - gap;
  if (top + height > window.innerHeight - edge) top = clientY - height - gap;

  propTooltip.style.left = `${clamp(left, edge, window.innerWidth - width - edge)}px`;
  propTooltip.style.top = `${clamp(top, edge, window.innerHeight - height - edge)}px`;
}

function showTooltip(prop, clientX, clientY) {
  tooltipTitle.textContent = prop.dataset.tooltipTitle;
  tooltipStory.textContent = prop.dataset.tooltipStory;
  propTooltip.classList.add("is-visible");
  propTooltip.setAttribute("aria-hidden", "false");
  positionTooltip(clientX, clientY);
}

function hideTooltip() {
  propTooltip.classList.remove("is-visible");
  propTooltip.setAttribute("aria-hidden", "true");
}

propButtons.forEach((prop) => {
  prop.addEventListener("pointerenter", (event) => showTooltip(prop, event.clientX, event.clientY));
  prop.addEventListener("pointermove", (event) => positionTooltip(event.clientX, event.clientY));
  prop.addEventListener("pointerleave", () => {
    if (document.activeElement !== prop) hideTooltip();
  });
  prop.addEventListener("focus", () => {
    const rect = prop.getBoundingClientRect();
    showTooltip(prop, rect.left + rect.width * 0.62, rect.top + rect.height * 0.45);
  });
  prop.addEventListener("blur", hideTooltip);
  prop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") prop.blur();
  });
});

function updateModel(progress) {
  const turn = smoothstep(0.03, 0.96, progress);
  const targetYaw = turn * 1.28 + pointerX * 0.035 * turn;
  const targetPitch = Math.sin(turn * Math.PI) * 0.008 + pointerY * 0.012 * turn;
  modelYaw = mix(modelYaw, targetYaw, 0.082);
  modelPitch = mix(modelPitch, targetPitch, 0.07);
  modelPivot.rotation.y = modelYaw;
  modelPivot.rotation.x = modelPitch;
  modelPivot.rotation.z = Math.sin(turn * Math.PI) * -0.007;
}

function updateMagicTrail(progress, now) {
  const growth = smoothstep(0.055, 0.82, progress);
  const fadeIn = smoothstep(0.035, 0.14, progress);
  const settle = 1 - smoothstep(0.86, 1, progress) * 0.55;
  const opacity = fadeIn * settle;
  const drawCount = Math.max(2, Math.ceil(growth * magicTrailPointCount));

  magicTrailGroup.visible = growth > 0.001;
  magicTrailGeometry.setDrawRange(0, drawCount);
  magicTrailMaterial.opacity = opacity * 0.62;
  magicSparkMaterial.opacity = opacity * 0.82;
  magicHeadMaterial.opacity = growth < 0.998 ? opacity : opacity * 0.36;
  magicTrailHead.position.copy(magicTrailPositions[Math.min(drawCount - 1, magicTrailPointCount - 1)]);

  const headPulse = 0.2 + Math.sin(now * 0.007) * 0.035;
  magicTrailHead.scale.setScalar(headPulse);
  magicTrailGroup.rotation.y = progress * -0.46;
}

function render(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  const damping = prefersReducedMotion.matches ? 1 : 1 - Math.pow(0.0008, delta);
  scrollProgress = mix(scrollProgress, rawScrollProgress, damping);
  if (Math.abs(scrollProgress - rawScrollProgress) < 0.0001) scrollProgress = rawScrollProgress;

  updateLayerVariables(scrollProgress);
  updateModel(scrollProgress);
  updateMagicTrail(scrollProgress, now);
  renderer.render(threeScene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("scroll", () => {
  updateScrollTarget();
  hideTooltip();
}, { passive: true });
window.addEventListener("resize", () => {
  updateScrollTarget();
  updateResponsiveCamera();
});

window.addEventListener("pointermove", (event) => {
  pointerX = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
  pointerY = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
}, { passive: true });

document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
  });
});

updateScrollTarget();
updateResponsiveCamera();
updateLayerVariables(0);
requestAnimationFrame(render);
