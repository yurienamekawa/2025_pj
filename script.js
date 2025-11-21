import {
  FilesetResolver, //FilesetResolverは必要なリソースを取得するための仕組み
  HandLandmarker //HandLandmarkerは手のランドマーク検出を行うクラス
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0"; //MediaPipe Tasks Visionライブラリのインポート

// ==========================================
// APIキー設定
const API_KEY = "ここにGoogle CloudのAPIキーを入力してください"; 
// ==========================================

// --- 変数定義 ---
let handLandmarker = undefined; //手のランドマーク検出器のインスタンスを格納
let capture; //カメラ映像キャプチャ用変数
let indexFingerTip = null; //人差し指の先端座標

// 軌跡データ
let history = []; // 人差し指の軌跡を保存する配列
const MAX_HISTORY = 60; // 軌跡の最大保存数
let cooldown = 0; // ジェスチャー認識のクールダウンタイム（ジェスチャーが連続して認識されるのを防ぐための待機時間）

// 音声・AI関連
let recognition; // 音声認識オブジェクト      
let isListening = false; // 音声認識中フラグ
let recognizedText = ""; // 認識されたテキストの保存

// 花の管理用（リストにする）
let flowers = []; // ここに生成された全ての花データを保存
let currentGestureCenter = { x: 0, y: 0 }; // ジェスチャーをした場所の一時保存

// --- 初期化 (Setup) ---
window.setup = async function() { // p5.jsのsetup関数
  createCanvas(windowWidth, windowHeight); // キャンバス作成
  
  capture = createCapture(VIDEO); // カメラ映像のキャプチャ開始
  capture.size(640, 480); // カメラ解像度設定
  capture.hide(); // デフォルトのビデオ要素を非表示にする

  await createHandLandmarker(); // MediaPipe HandLandmarkerの初期化
  setupSpeechRecognition(); // 音声認識の初期化

  console.log("システム準備完了: たくさん花を咲かせましょう！");
};

window.windowResized = function() { // ウィンドウリサイズ時の処理
  resizeCanvas(windowWidth, windowHeight); // キャンバスサイズをウィンドウサイズに合わせて変更
};

// --- イージング関数 ---
//アニメーションの動きを滑らかにするための数学的手法
//easeOutBack：アニメーションの終わりに向かって速くなり、少し戻るような動きを作り出す
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// --- 描画ループ (Draw) ---
window.draw = function() { // p5.jsのdraw関数
  background('#A3D78A'); // 背景色設定

  if (cooldown > 0) cooldown--; // クールダウンタイムの減少

  // リストに入っている花をひとつずつ取り出して描画
  for (let flower of flowers) {
    drawFlowerObject(flower);
  }

  //ジェスチャー認識と描画
  if (capture && capture.loadedmetadata) { // カメラ映像が利用可能な場合
    detectHands(); // 手の検出

    // 軌跡更新
    if (indexFingerTip) { // 人差し指の先端が検出された場合
      history.unshift({ x: indexFingerTip.x, y: indexFingerTip.y }); // 先頭に追加
      if (history.length > MAX_HISTORY) history.pop(); // 最大数を超えたら削除
    }

    // 指先（ピンクの光）
    if (indexFingerTip) { // 人差し指の先端が検出された場合
      noStroke(); // 枠線なし
      fill(255, 0, 255); // ピンク色
      drawingContext.shadowBlur = 20; // ぼかし効果
      drawingContext.shadowColor = 'magenta'; // 影の色
      ellipse(indexFingerTip.x, indexFingerTip.y, 20, 20); // 円を描画
      drawingContext.shadowBlur = 0; // ぼかし効果リセット
    }

    // ジェスチャー判定
    if (cooldown === 0 && !isListening && checkCircleGesture()) { // クールダウン中でなく、音声認識中でなく、円ジェスチャーが検出された場合
      console.log("円を検知！"); // デバッグ用ログ
      
      // 今描いた円の中心を計算して一時保存
      calculateCenter(); // ジェスチャーの中心座標を計算
      startListening();  // 音声認識開始
      cooldown = 120; // クールダウンタイム設定（約2秒）
      history = []; // 軌跡リセット
    }
  }

    // UI描画
  drawUI();
};

// 個別の花を描画する関数
function drawFlowerObject(flower) {
  // アニメーション計算
  let elapsed = millis() - flower.spawnTime; // 花が生まれてからの経過時間
  const duration = 1200; // アニメーションの総時間（ミリ秒）
  
  let t = constrain(elapsed / duration, 0, 1); // 0から1の範囲に制限
  let currentScale = easeOutBack(t); // イージング関数でスケール計算
  
  // 光のエフェクト（オブジェクト登場時のみ）
  let glowAlpha = map(t, 0, 0.3, 255, 0, true);

  // 回転アニメーション（時間経過でずっと回り続ける）
  // flower.rotationOffset は個体差をつけるためのランダム値
  let rotation = (millis() * 0.0005) + flower.rotationOffset;

  push(); // 新しい描画状態を保存
  translate(flower.x, flower.y); // 花の位置に移動
  scale(currentScale); // スケール適用
  rotate(rotation); // 回転適用
  
  noStroke();

  // 光る演出（登場時）
  if (glowAlpha > 1) {
    fill(255, 255, 255, glowAlpha); 
    drawingContext.shadowBlur = 60; 
    drawingContext.shadowColor = 'white';
    let glowSize = (flower.params.petal_radius || 100) * 3;
    ellipse(0, 0, glowSize, glowSize);
    drawingContext.shadowBlur = 0; 
  }

  // 花びらの描画
  const params = flower.params;
  const count = params.petal_count || 5;
  const radius = params.petal_radius || 100;
  const w = params.petal_width || 30;
  const layers = params.layer_count || 1;
  const col = color(params.color_hex || "#FFFFFF");

  for (let j = 0; j < layers; j++) {
    let scaleFactor = 1 - (j * 0.2);
    fill(col);
    for (let i = 0; i < count; i++) {
      push();
      rotate(TWO_PI * i / count);
      beginShape();
      vertex(0, 0); 
      bezierVertex(-w * scaleFactor, radius * 0.5 * scaleFactor, 
                   -w * scaleFactor, radius * scaleFactor, 
                   0, radius * scaleFactor); 
      bezierVertex(w * scaleFactor, radius * scaleFactor, 
                   w * scaleFactor, radius * 0.5 * scaleFactor, 
                   0, 0); 
      endShape();
      pop();
    }
  }

  // 中心
  fill(params.center_color_hex || "#FFFF00");
  ellipse(0, 0, radius * 0.2, radius * 0.2);

  pop();
}

// --- 補助関数 ---
function calculateCenter() {
  let sumX = 0, sumY = 0;
  for (let p of history) {
    sumX += p.x;
    sumY += p.y;
  }
  // ジェスチャーの中心座標を更新
  currentGestureCenter = {
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
  else if (recognizedText !== "") {
    // 生成待ちの表示（花が増えるので、邪魔にならないよう少し控えめに）
    fill(255, 255, 255, 200);
    textSize(24);
    text(`生成中: 「${recognizedText}」`, width / 2, height - 50);
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
        console.log("🌸 新しい花を追加しました！");
        
        // ★変更: 新しい花オブジェクトを作成してリストに追加
        flowers.push({
            params: params,           // AIが決めた形や色
            x: currentGestureCenter.x, // 円を描いた場所
            y: currentGestureCenter.y,
            spawnTime: millis(),      // 生まれた時間
            rotationOffset: random(TWO_PI) // それぞれ違う角度で回り始める
        });
        
        // 認識テキストをリセット
        setTimeout(() => { recognizedText = ""; }, 3000);
    }
  };
}

function startListening() {
  if (recognition && !isListening) {
    try { recognition.start(); } catch (e) { console.error(e); }
  }
}

// --- Gemini API (gemini-2.0-flash) ---
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
      "petal_radius": 30〜150の整数, 
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