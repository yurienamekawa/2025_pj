import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ==========================================
// ★ここに取得したAPIキーを貼り付けてください
const API_KEY = "ここにAPIキーを貼り付けてください"; 
// ==========================================

// --- 変数定義 ---
let handLandmarker = undefined;
let capture;
let indexFingerTip = null;

// 軌跡データ
let history = []; 
const MAX_HISTORY = 60; 
let cooldown = 0; 

// 音声・AI関連
let recognition;        
let isListening = false; 
let recognizedText = ""; 

// 花の生成関連（★追加）
let flowerParams = null; // AIから届いた設計図
let flowerPos = { x: 0, y: 0 }; // 花を咲かせる場所
let flowerRotation = 0;  // 回転アニメーション用

// --- 初期化 (Setup) ---
window.setup = async function() {
  createCanvas(windowWidth, windowHeight);
  
  // カメラ設定
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // AIモデルと音声認識の準備
  await createHandLandmarker();
  setupSpeechRecognition();

  console.log("システム準備完了: 円を描いて話しかけてください");
};

window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

// --- 描画ループ (Draw) ---
window.draw = function() {
  background(0); // 黒背景

  if (cooldown > 0) cooldown--;

  // 1. 花の描画（データがある場合のみ）
  if (flowerParams) {
    drawGenerativeFlower(flowerPos.x, flowerPos.y, flowerParams);
  }

  // 2. カメラと手の処理
  if (capture && capture.loadedmetadata) {
    detectHands();

    // 指の軌跡更新
    if (indexFingerTip) {
      history.unshift({ x: indexFingerTip.x, y: indexFingerTip.y });
      if (history.length > MAX_HISTORY) history.pop();
    }

    // 指先（ピンクの光）描画
    if (indexFingerTip) {
      noStroke();
      fill(255, 0, 255);
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = 'magenta';
      ellipse(indexFingerTip.x, indexFingerTip.y, 20, 20);
      drawingContext.shadowBlur = 0;
    }

    // ジェスチャー判定
    if (cooldown === 0 && !isListening && checkCircleGesture()) {
      console.log("円を検知！");
      
      // ★円を描いた場所（軌跡の中心）を計算して保存
      calculateCenter();
      
      // 既存の花をリセット
      flowerParams = null;
      
      startListening(); 
      cooldown = 120;   
      history = [];     
    }
  }

  // 3. UI情報の表示
  drawUI();
};

// --- ★追加: ジェネレーティブ・フラワー描画関数 ---
function drawGenerativeFlower(x, y, params) {
  push();
  translate(x, y);
  
  // ゆっくり回転させる
  flowerRotation += 0.005;
  rotate(flowerRotation);

  noStroke();
  
  // 花びらの描画
  const count = params.petal_count || 5;
  const radius = params.petal_radius || 100;
  const w = params.petal_width || 30;
  const layers = params.layer_count || 1;
  const col = color(params.color_hex || "#FFFFFF");

  // 層（レイヤー）ごとの描画
  for (let j = 0; j < layers; j++) {
    // 内側の層ほど少し小さく、少し明るく
    let scaleFactor = 1 - (j * 0.2);
    fill(col);
    
    // 360度ぐるっと配置
    for (let i = 0; i < count; i++) {
      push();
      rotate(TWO_PI * i / count);
      
      // 花びらの形（楕円を変形させて作る）
      beginShape();
      vertex(0, 0); // 中心
      // ベジェ曲線で有機的なカーブを描く
      bezierVertex(-w * scaleFactor, radius * 0.5 * scaleFactor, 
                   -w * scaleFactor, radius * scaleFactor, 
                   0, radius * scaleFactor); // 先端
      bezierVertex(w * scaleFactor, radius * scaleFactor, 
                   w * scaleFactor, radius * 0.5 * scaleFactor, 
                   0, 0); // 中心に戻る
      endShape();
      pop();
    }
  }

  // 中心の描画
  fill(params.center_color_hex || "#FFFF00");
  ellipse(0, 0, radius * 0.2, radius * 0.2);

  pop();
}

// --- 補助関数: 軌跡の中心を計算 ---
function calculateCenter() {
  let sumX = 0, sumY = 0;
  for (let p of history) {
    sumX += p.x;
    sumY += p.y;
  }
  flowerPos = {
    x: sumX / history.length,
    y: sumY / history.length
  };
}

// --- UI描画 ---
function drawUI() {
  textAlign(CENTER, CENTER);
  noStroke();

  if (isListening) {
    fill(255, 100, 100);
    textSize(40);
    text("聞いています...", width / 2, height / 2);
    let pulse = map(sin(millis() / 200), -1, 1, 10, 20);
    ellipse(width / 2, height / 2 + 60, 20 + pulse, 20 + pulse);
  } 
  else if (recognizedText !== "" && !flowerParams) {
    // 生成待ちの間
    fill(255);
    textSize(32);
    text(`「${recognizedText}」`, width / 2, height / 2);
    textSize(16);
    fill(200);
    text("AIが花を咲かせようとしています...", width / 2, height / 2 + 50);
  }
}

// --- 音声認識 ---
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP'; 
  recognition.interimResults = false; 
  recognition.maxAlternatives = 1;

  recognition.onstart = () => { isListening = true; recognizedText = ""; };
  recognition.onend = () => { isListening = false; };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    recognizedText = transcript;
    console.log("認識結果:", transcript);
    
    // AI呼び出し
    const params = await callGemini(transcript);
    if (params) {
        console.log("🌸 パラメータ生成完了！描画を開始します");
        flowerParams = params; // これが入ると draw() で花が描かれます
    }
  };
}

function startListening() {
  if (recognition && !isListening) {
    try { recognition.start(); } catch (e) { console.error(e); }
  }
}

// --- Gemini API (2.0 Flash) ---
async function callGemini(text) {
  if (!API_KEY || API_KEY.includes("ここに")) {
      console.error("APIキー未設定エラー");
      return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const prompt = `
    ユーザー入力: 「${text}」
    この言葉から連想される「架空の花」の視覚的特徴をJSONで出力してください。
    JSONのみ出力し、Markdown記法は含めないでください。
    {
      "color_hex": "#RRGGBB", 
      "center_color_hex": "#RRGGBB",
      "petal_count": 3〜20の整数,
      "petal_radius": 50〜200の整数,
      "petal_width": 10〜80の整数,
      "layer_count": 1〜3の整数
    }
  `;

  const data = { contents: [{ parts: [{ text: prompt }] }] };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!response.ok) return null;

    const json = await response.json();
    const resultText = json.candidates[0].content.parts[0].text;
    const cleanJson = resultText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error(error);
    return null;
  }
}

// --- MediaPipe & Gesture ---
function checkCircleGesture() {
  if (history.length < 30) return false;
  let start = history[0];
  let end = history[history.length - 1];
  let distStartEnd = dist(start.x, start.y, end.x, end.y);

  let minX = width, maxX = 0, minY = height, maxY = 0;
  for(let p of history) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // 判定基準
  if (distStartEnd < 60 && (maxX - minX) > 150 && (maxY - minY) > 150) {
    return true;
  }
  return false;
}

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
}

async function detectHands() {
  if (!handLandmarker || !capture.elt) return;
  const results = handLandmarker.detectForVideo(capture.elt, millis());
  if (results.landmarks && results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const fingerTip = hand[8];
    const x = (1 - fingerTip.x) * width; 
    const y = fingerTip.y * height;
    indexFingerTip = { x, y };
  } else {
    indexFingerTip = null;
  }
}