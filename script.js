import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ==========================================
// ★ここに取得したAPIキーを貼り付けてください
const API_KEY = "ここにAPIキーを貼り付けてください"; 
// ==========================================

// --- グローバル変数 ---
let renderer, scene, camera, composer;
let handLandmarker, videoElement;
let indexFingerTip = null; 
let cursorMesh; 

let history = [];
const MAX_HISTORY = 60;
let cooldown = 0;
let recognition, isListening = false;

let flowers = []; 
let historyPoint = null; 

const statusUI = document.getElementById('status-text');
const resultUI = document.getElementById('result-text');

// --- 初期化 ---
init();

async function init() {
  // 1. レンダラー
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false }); // PostProcess時はfalse推奨
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // 2. シーン & カメラ
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // 完全な黒（ネオンが映える）

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  // 3. ポストプロセス（発光エフェクト）
  const renderScene = new RenderPass(scene, camera);
  
  // ブルーム設定 (解像度, 強さ, 半径, 閾値)
  // 強さ(1.5)と半径(0.5)で「ふわっとしたネオン感」を出します
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.5, 0.0);
  
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // 4. カーソル（指先）
  const cursorGeo = new THREE.SphereGeometry(0.05, 16, 16);
  const cursorMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
  cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);
  scene.add(cursorMesh);
  cursorMesh.visible = false;

  // 5. AI & カメラ
  videoElement = document.getElementById('input-video');
  statusUI.innerText = "CAMERA STARTING...";
  await setupCamera();
  
  statusUI.innerText = "AI LOADING...";
  await createHandLandmarker();
  
  setupSpeechRecognition();

  statusUI.innerText = "READY: DRAW A CIRCLE";

  animate();
  window.addEventListener('resize', onWindowResize);
}

// --- メインループ ---
function animate() {
  requestAnimationFrame(animate);

  if (cooldown > 0) cooldown--;

  detectHands(); 

  if (indexFingerTip) {
    cursorMesh.visible = true;
    cursorMesh.position.lerp(indexFingerTip, 0.2);
    cursorMesh.rotation.y += 0.1;
  } else {
    cursorMesh.visible = false;
  }

  if (cooldown === 0 && !isListening && checkCircleGesture()) {
    startListening();
    cooldown = 120;
    history = [];
  }

  // 花のアニメーション
  flowers.forEach(flower => {
    // ゆっくり回転
    flower.mesh.rotation.y += 0.003;
    flower.mesh.rotation.z += 0.001;

    // 登場アニメーション
    flower.mesh.scale.lerp(new THREE.Vector3(flower.baseScale, flower.baseScale, flower.baseScale), 0.05);
    
    // 感情による揺れ（喜びなら弾む）
    if (flower.params.emotion === "joy") {
        flower.mesh.scale.multiplyScalar(1 + Math.sin(performance.now() * 0.005) * 0.005);
    }
  });

  // レンダラーではなくコンポーザーで描画（発光させるため）
  composer.render();
}

// --- ★修正: ネオン風ボタニカルフラワー生成 ---
function createBotanicalFlower(params, position) {
  const group = new THREE.Group();

  const petalCount = params.petal_count || 13; 
  const color = new THREE.Color(params.color_hex);
  const centerColor = new THREE.Color(params.center_color_hex);
  const sharpness = params.sharpness || 0.0;
  
  // マテリアル（ワイヤーフレームで発光させる）
  // MeshBasicMaterialはライトの影響を受けず、自ら発光しているように見えます
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: color,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
  });

  const centerMaterial = new THREE.MeshBasicMaterial({
    color: centerColor,
    wireframe: true
  });

  // 1. 花の中心（宝石のような多面体）
  // Icosahedron（正20面体）を使うとキラキラして可愛いです
  const centerGeo = new THREE.IcosahedronGeometry(0.3, 1); 
  const centerMesh = new THREE.Mesh(centerGeo, centerMaterial);
  group.add(centerMesh);

  // 2. 花弁の形状
  let petalGeo;
  // 低ポリゴンの球体を使うと、クリスタルのような可愛い形になります
  // widthSegments, heightSegments を小さくするのがコツ
  if (params.geometry_type === "cone" || params.emotion === "anger") {
    // 怒り/鋭い: 円錐
    petalGeo = new THREE.ConeGeometry(0.2, 1.2, 5, 3, true); 
    petalGeo.rotateX(Math.PI / 2);
    petalGeo.translate(0, 0, 0.6); // 原点を根元に
  } else {
    // 通常/喜び: ぷっくりした花びら (球体を変形)
    // セグメント数(10, 6)くらいがワイヤーフレームで可愛く見える
    petalGeo = new THREE.SphereGeometry(0.5, 10, 6);
    petalGeo.scale(0.5, 0.2, 1.0); // 平たく伸ばす
    petalGeo.translate(0, 0, 0.5); // 原点を根元にずらす
  }

  // フィボナッチ配置
  const goldenAngle = 137.5 * (Math.PI / 180);

  for (let i = 0; i < petalCount; i++) {
    const petal = new THREE.Mesh(petalGeo, lineMaterial);
    
    const angle = i * goldenAngle;
    // 半径を小さくして、中心にギュッと集める（一体感を出す）
    const radius = 0.2 * Math.sqrt(i); 
    
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    
    // 花びらの配置
    // 親(pivot)を作って回転させることで、自然な開き方を表現
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0); // 中心の位置
    pivot.add(petal); // 花びらを子にする

    // 1. Y軸回転（配置する方向）
    pivot.rotation.y = -angle; 
    
    // 2. Z/X軸回転（花びらの開き具合）
    // 外側ほど大きく開く
    const openAngle = (i / petalCount) * 0.5 + 0.3; 
    pivot.rotation.x = openAngle;

    // 悲しい時は垂れ下がる
    if (params.emotion === "sadness") {
        pivot.rotation.x += 1.5; 
    }

    // 個体差スケール（内側は小さく、外側は大きく）
    const scale = 0.5 + (i / petalCount) * 0.5;
    petal.scale.setScalar(scale);

    group.add(pivot);
  }

  // 全体をカメラの方へ向ける
  group.rotation.x = Math.PI * 0.2; 
  group.rotation.z = Math.PI * 0.1;

  group.position.copy(position);
  group.scale.set(0, 0, 0); 
  
  scene.add(group);
  flowers.push({ 
    mesh: group, 
    params: params, 
    baseScale: 1.0 
  });
}

// --- AI連携 ---
async function callGemini(text) {
  if (!API_KEY || API_KEY.includes("ここに")) {
      console.error("API Error"); return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `
    Input: "${text}"
    Analyze emotion and semantics.
    Output JSON only:
    {
      "emotion": "joy" | "anger" | "sadness" | "calm",
      "geometry_type": "standard" | "cone",
      "color_hex": "#RRGGBB" (Neon/Bright colors preferred),
      "center_color_hex": "#RRGGBB",
      "petal_count": integer (8-30),
      "sharpness": 0.0-1.0
    }
  `;
  
  const data = { contents: [{ parts: [{ text: prompt }] }] };
  try {
    const response = await fetch(url, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)});
    if (!response.ok) return null;
    const json = await response.json();
    const txt = json.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(txt);
  } catch (e) { console.error(e); return null; }
}

// --- MediaPipe ---
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  return new Promise(r => { videoElement.onloadedmetadata = r; });
}
async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
    runningMode: "VIDEO", numHands: 1
  });
}
async function detectHands() {
  if (!handLandmarker || !videoElement) return;
  const results = handLandmarker.detectForVideo(videoElement, performance.now());
  
  if (results.landmarks && results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const fingerTip = hand[8]; 
    
    historyPoint = { x: (1 - fingerTip.x) * window.innerWidth, y: fingerTip.y * window.innerHeight };
    
    const x = (1 - fingerTip.x) * 2 - 1; 
    const y = -(fingerTip.y * 2 - 1);
    const vec = new THREE.Vector3(x, y, 0.5);
    vec.unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z; 
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    indexFingerTip = pos;

    if (historyPoint) {
      history.unshift(historyPoint);
      if (history.length > MAX_HISTORY) history.pop();
    }
  } else { indexFingerTip = null; }
}

function checkCircleGesture() {
  if (history.length < 30) return false;
  let start = history[0]; let end = history[history.length - 1];
  let dist = Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2));
  let minX = 10000, maxX = 0, minY = 10000, maxY = 0;
  for(let p of history) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return (dist < 100 && (maxX - minX) > 100 && (maxY - minY) > 100);
}

// --- 音声認識 ---
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP'; recognition.interimResults = false;

  recognition.onstart = () => { 
    isListening = true; 
    statusUI.innerText = "LISTENING..."; 
    statusUI.style.color = "#0ff";
    resultUI.innerText = "";
  };
  recognition.onend = () => { isListening = false; if(statusUI.innerText.includes("LISTENING")) { statusUI.innerText = "READY"; statusUI.style.color = "#888"; } };
  
  recognition.onresult = async (event) => {
    const txt = event.results[0][0].transcript;
    resultUI.innerText = txt;
    statusUI.innerText = "GENERATING...";
    
    const params = await callGemini(txt);
    if (params) {
      let spawnPos = indexFingerTip ? indexFingerTip.clone() : new THREE.Vector3(0,0,0);
      createBotanicalFlower(params, spawnPos);
      statusUI.innerText = "GENERATED";
    }
  };
}

function startListening() { if (recognition && !isListening) try { recognition.start(); } catch (e) { console.error(e); } }
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}