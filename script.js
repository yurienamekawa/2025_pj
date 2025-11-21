import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let capture;
let indexFingerTip = null;

// 軌跡データ
let history = []; 
const MAX_HISTORY = 60; 
let cooldown = 0; 

// --- ★追加: 音声認識用の変数 ---
let recognition;        // 音声認識オブジェクト
let isListening = false; // 現在聞いているかどうかのフラグ
let recognizedText = ""; // 認識された言葉を保存する変数

window.setup = async function() {
  createCanvas(windowWidth, windowHeight);
  
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // 1. AI(MediaPipe)の準備
  await createHandLandmarker();
  
  // 2. ★追加: 音声認識のセットアップ
  setupSpeechRecognition();

  console.log("システム準備完了");
};

window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

window.draw = function() {
  background(0); // 黒背景

  if (cooldown > 0) cooldown--;

  if (capture && capture.loadedmetadata) {
    detectHands();

    // --- A. 軌跡の処理 ---
    if (indexFingerTip) {
      history.unshift({ x: indexFingerTip.x, y: indexFingerTip.y });
      if (history.length > MAX_HISTORY) history.pop();
    }

    // --- B. 描画 ---
    /*
    // 軌跡（水色）
    noFill();
    stroke(0, 255, 255, 150); // 少し透明に
    strokeWeight(4);
    beginShape();
    for (let i = 0; i < history.length; i++) {
      vertex(history[i].x, history[i].y);
    }
    endShape();

    */

    // 指先（ピンク）
    if (indexFingerTip) {
      noStroke();
      fill(255, 0, 255);
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = 'magenta';
      ellipse(indexFingerTip.x, indexFingerTip.y, 20, 20);
      drawingContext.shadowBlur = 0;
    }

    // --- C. ジェスチャー判定と音声開始 ---
    // クールダウン中でなく、まだ聞いていない状態で、円を検知したら
    if (cooldown === 0 && !isListening && checkCircleGesture()) {
      console.log("円を検知！音声認識を開始します。");
      startListening(); // ★音声認識をスタート
      cooldown = 120;   // 誤作動防止のため少し長めに待機
      history = [];     // 軌跡をリセット
    }
  }

  // --- D. ★追加: 状態とテキストの表示 ---
  drawUI();
};

// --- ★追加: UI描画関数 ---
function drawUI() {
  textAlign(CENTER, CENTER);
  noStroke();

  // 1. 聞いている最中の表示
  if (isListening) {
    fill(255, 100, 100); // 赤っぽい色
    textSize(40);
    text("聞いています...", width / 2, height / 2);
    
    // マイクアイコンっぽい円を点滅させる演出
    let pulse = map(sin(millis() / 200), -1, 1, 10, 20);
    ellipse(width / 2, height / 2 + 50, 20 + pulse, 20 + pulse);
  } 
  // 2. 認識結果の表示
  else if (recognizedText !== "") {
    fill(255);
    textSize(32);
    text(`認識結果: 「${recognizedText}」`, width / 2, height / 2);
    
    textSize(16);
    fill(150);
    text("もう一度円を描くとリセットされます", width / 2, height / 2 + 50);
  }
}

// --- ★追加: 音声認識のセットアップ関数 ---
function setupSpeechRecognition() {
  // ブラウザごとのプレフィックス対応
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("このブラウザは音声認識に対応していません。Chrome推奨です。");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP'; // 日本語
  recognition.interimResults = false; // 確定した結果だけ取得する
  recognition.maxAlternatives = 1;

  // 認識が始まったら
  recognition.onstart = () => {
    isListening = true;
    recognizedText = ""; // 前回のテキストをクリア
  };

  // 認識が終わったら（無音になったら自動で止まる）
  recognition.onend = () => {
    isListening = false;
  };

  // 結果が返ってきたら
  recognition.onresult = (event) => {
    // 結果配列の一番目を取得
    const transcript = event.results[0][0].transcript;
    recognizedText = transcript;
    console.log("認識結果:", transcript);
    
    // ★次のステップ（Step 4）でここでGeminiを呼び出します
  };
  
  // エラーハンドリング
  recognition.onerror = (event) => {
    console.error("音声認識エラー:", event.error);
    isListening = false;
  };
}

// 音声認識を開始するラッパー関数
function startListening() {
  if (recognition && !isListening) {
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  }
}

// --- MediaPipe & 円判定 (変更なし) ---
function checkCircleGesture() {
  if (history.length < 30) return false;
  let start = history[0];
  let end = history[history.length - 1];
  let distance = dist(start.x, start.y, end.x, end.y);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for(let p of history) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  let boxWidth = maxX - minX;
  let boxHeight = maxY - minY;

  if (distance < 60 && boxWidth > 150 && boxHeight > 150) {
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