import * as THREE from 'three';
// ★追加: ポストプロセス（エフェクト）用のモジュール
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ==========================================
// ★ここに取得したAPIキーを貼り付けてください
const API_KEY = "ここにあなたのAPIキーを貼り付けてください"; 
// ==========================================

// --- グローバル変数 ---
let renderer, scene, camera, composer; // composerを追加
let handLandmarker, videoElement;
let indexFingerTip = null; 
let cursorMesh; 

let history = [];
const MAX_HISTORY = 60;
let cooldown = 0;
let recognition, isListening = false;

let flowers = []; 
let historyPoint = null;

// UI
const statusUI = document.getElementById('status-text');
const resultUI = document.getElementById('result-text');

// --- 初期化 ---
init();

async function init() {
  // 1. レンダラー設定
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false }); // ポストプロセスを使うときはantialiasをfalseにするのが一般的
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // ★重要: 発光表現のためにトーンマッピングを設定
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.5; // 全体の明るさ

  // 2. シーン設定
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // 完全な黒背景

  // 3. カメラ設定
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  // ★追加: ライトは不要ですが、雰囲気用に弱い環境光だけ入れておきます
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // 4. ★追加: ポストプロセス（ブルーム効果）の設定
  const renderScene = new RenderPass(scene, camera);
  // ブルームパラメータ: 解像度, 強さ, 半径, 閾値
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.0, 0.4, 0.1);

  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // 5. 指先カーソル（これもワイヤーフレームにする）
  // セグメント数を減らしてデジタル感を出す (16, 8)
  const cursorGeo = new THREE.SphereGeometry(0.05, 16, 8); 
  const cursorMat = new THREE.MeshBasicMaterial({ 
    color: 0xff00ff, 
    wireframe: true // ★ワイヤーフレーム化
  });
  cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);
  scene.add(cursorMesh);
  cursorMesh.visible = false;

  // 6. MediaPipe & 音声認識準備
  videoElement = document.getElementById('input-video');
  statusUI.innerText = "SYSTEM INITIALIZING...";
  await setupCamera();
  await createHandLandmarker();
  setupSpeechRecognition();

  statusUI.innerText = "READY: DRAW A CIRCLE";

  // 7. アニメーション開始
  animate();
  
  window.addEventListener('resize', onWindowResize);
}

// --- メインループ ---
function animate() {
  requestAnimationFrame(animate);

  if (cooldown > 0) cooldown--;

  detectHands(); 

  // 指先カーソルの更新
  if (indexFingerTip) {
    cursorMesh.visible = true;
    cursorMesh.position.lerp(indexFingerTip, 0.2);
    // カーソルも少し回転させる
    cursorMesh.rotation.y += 0.05;
    cursorMesh.rotation.x += 0.02;
  } else {
    cursorMesh.visible = false;
  }

  // ジェスチャー判定
  if (cooldown === 0 && !isListening && checkCircleGesture()) {
    startListening();
    cooldown = 120;
    history = [];
  }

  // 花のアニメーション
  flowers.forEach(flower => {
    // ゆっくり回転
    flower.mesh.rotation.y += 0.005;
    flower.mesh.rotation.z += 0.002; // 回転軸を少し変えてみる
    
    // 登場時の拡大アニメーション
    if (flower.mesh.scale.x < 1.0) {
      flower.mesh.scale.addScalar(0.03); // 少し速く出現
    }
  });

  // ★変更: レンダラーではなく、コンポーザーを通じて描画する
  composer.render();
}

// --- 3Dフラワー生成ロジック (線画アート版) ---
function create3DFlower(params, position) {
  const group = new THREE.Group();

  // 色とパラメータの準備
  const colorHex = params.color_hex || "#00ffff"; // デフォルトをサイバーな水色に
  const centerColorHex = params.center_color_hex || "#ffffff";
  const petalCount = params.petal_count || 8;

  // ★ワイヤーフレーム用のマテリアルを作成
  // MeshBasicMaterial は光の影響を受けず、指定した色で発光するように見える
  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    wireframe: true,
    // wireframeLinewidth: 2, // ※WebGLレンダラーでは線の太さは効かないことが多いです
  });
  
  const centerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(centerColorHex),
    wireframe: true
  });

  // 1. 花の中心（雄しべ）
  // セグメントを減らしてカクカクさせる (12, 8)
  const centerGeo = new THREE.SphereGeometry(0.2, 12, 8);
  const centerMesh = new THREE.Mesh(centerGeo, centerMaterial);
  group.add(centerMesh);

  // 2. 花びら
  // セグメントを減らしてデジタル感を出す (16, 12)
  const petalGeo = new THREE.SphereGeometry(1, 16, 12);

  for (let i = 0; i < petalCount; i++) {
    const petal = new THREE.Mesh(petalGeo, wireframeMaterial);
    
    // 変形パラメータ
    const width = (params.petal_width || 30) / 60.0;
    const length = (params.petal_radius || 100) / 80.0;
    
    // x:幅, y:長さ, z:薄さ（線画なので薄さはあまり関係ないが、一応設定）
    petal.scale.set(0.2 + width * 0.2, length, 0.1); 
    petal.position.y = length * 0.4; 

    // 角度調整用の親グループ
    const pivot = new THREE.Group();
    pivot.add(petal);
    
    // 放射状に配置
    pivot.rotation.z = (i / petalCount) * Math.PI * 2;
    pivot.rotation.x = 0.3; 
    
    group.add(pivot);
  }

  // 生成位置設定
  let spawnPos = position ? position : new THREE.Vector3(0, 0, 0);
  group.position.copy(spawnPos);
  group.scale.set(0, 0, 0); 
  
  scene.add(group);
  flowers.push({ mesh: group });
}

// --- AI連携 (Gemini API) ---
async function callGemini(text) {
  if (!API_KEY || API_KEY.includes("ここに")) {
      console.error("APIキー未設定"); return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `
    ユーザー入力:「${text}」
    この言葉から連想される「サイバーパンク風の花」の視覚的特徴をJSONで出力。
    色はネオンカラーを意識して。
    {
      "color_hex": "#RRGGBB (ネオンカラー)",
      "center_color_hex": "#RRGGBB (中心の発光色)",
      "petal_count": 5〜20の整数,
      "petal_radius": 50〜150の整数,
      "petal_width": 10〜50の整数
    }
    MarkdownなしJSONのみ。
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

// --- MediaPipe (手認識) ---
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
    
    historyPoint = { 
      x: (1 - fingerTip.x) * window.innerWidth, 
      y: fingerTip.y * window.innerHeight 
    };
    
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
  } else {
    indexFingerTip = null;
  }
}

// --- ジェスチャー判定 ---
function checkCircleGesture() {
  if (history.length < 30) return false;
  let start = history[0]; let end = history[history.length - 1];
  let dist = Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2));
  let minX = 10000, maxX = 0, minY = 10000, maxY = 0;
  for(let p of history) { 
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); 
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); 
  }
  if (dist < 100 && (maxX - minX) > 100 && (maxY - minY) > 100) return true;
  return false;
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
    resultUI.innerText = ""; 
    resultUI.style.color = "#0ff"; // 水色
  };

  recognition.onend = () => { 
    isListening = false; 
    if(statusUI.innerText.includes("LISTENING")) {
        statusUI.innerText = "READY: DRAW A CIRCLE"; 
    }
  };

  recognition.onresult = async (event) => {
    const txt = event.results[0][0].transcript;
    resultUI.innerText = `"${txt.toUpperCase()}"`;
    statusUI.innerText = "GENERATING...";
    resultUI.style.color = "#ff0"; // 黄色

    try {
      const params = await callGemini(txt);
      if (params) {
        let spawnPosition;
        if (indexFingerTip) {
            spawnPosition = indexFingerTip.clone();
        } else {
            spawnPosition = new THREE.Vector3(0, 0, 0);
        }
        create3DFlower(params, spawnPosition);
        statusUI.innerText = "GENERATED";
        resultUI.style.color = "#0f0"; // 緑色
      } else {
        statusUI.innerText = "ERROR: API FAIL";
        resultUI.style.color = "#f00"; // 赤色
      }
    } catch (e) {
      console.error(e);
      statusUI.innerText = "ERROR: SYSTEM";
      resultUI.style.color = "#f00";
    }
  };
}

function startListening() { if (recognition && !isListening) try { recognition.start(); } catch (e) { console.error(e); } }
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight); // composerもリサイズ
}