import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let capture; // カメラデータ自体は取得しますが、画面には描きません
let indexFingerTip = null;

// 軌跡の履歴
let history = []; 
const MAX_HISTORY = 60; 
let cooldown = 0; 

window.setup = async function() {
  // ★変更1: 画面いっぱいにキャンバスを作成
  createCanvas(windowWidth, windowHeight);
  
  // カメラ入力の設定（解像度は低くても認識精度にはあまり影響しません）
  capture = createCapture(VIDEO);
  capture.size(640, 480); // 認識用の内部解像度
  capture.hide(); // HTML要素としての表示を隠す

  await createHandLandmarker();
  console.log("準備完了");
};

// ★追加: ウィンドウのサイズが変わった時にキャンバスも追従させる
window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

window.draw = function() {
  // ★変更2: 背景を黒で塗りつぶす（カメラ映像を描画しない）
  background(0);

  if (cooldown > 0) cooldown--;

  // カメラ映像の準備ができていれば検出を実行
  if (capture && capture.loadedmetadata) {
    
    // ★注意: ここにあった image(...) を削除しました

    detectHands();
    
    // --- 軌跡の処理 ---
    if (indexFingerTip) {
      history.unshift({ x: indexFingerTip.x, y: indexFingerTip.y });
      if (history.length > MAX_HISTORY) history.pop();
    } else {
      // 指が見えない時は履歴を少しずつ消す演出を入れても面白いかも
      // history = []; 
    }

    // --- 描画 ---
    
    // 軌跡（サイバーな水色）
    noFill();
    stroke(0, 255, 255);
    strokeWeight(4);
    beginShape();
    for (let i = 0; i < history.length; i++) {
      vertex(history[i].x, history[i].y);
    }
    endShape();

    // 指先（ピンクの点）
    if (indexFingerTip) {
      noStroke();
      fill(255, 0, 255);
      // 少し大きくして光っているように見せる
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = 'magenta';
      ellipse(indexFingerTip.x, indexFingerTip.y, 30, 30);
      drawingContext.shadowBlur = 0; // リセット
    }

    // ジェスチャー判定
    if (cooldown === 0 && checkCircleGesture()) {
      console.log("Circle Detected!");
      
      // 認識時のエフェクト（画面が一瞬白く光るなど）
      background(50); 
      
      fill(255, 255, 0);
      textSize(64);
      textAlign(CENTER);
      text("Voice Input Start!", width/2, height/2);
      
      cooldown = 60; 
      history = [];
    }
  } else {
    // 起動中のローディング表示
    fill(100);
    textAlign(CENTER);
    textSize(20);
    text("Initializing AI...", width/2, height/2);
  }
};

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

  // 判定基準（全画面になったので、判定サイズも少し大きめに調整してもいいかも）
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
    
    // ★変更3: 座標計算を全画面に対応させる
    // p5.jsの width, height は現在ウィンドウサイズになっています
    // 正規化座標(0~1)に画面サイズを掛けることで、画面全体を使えます
    const x = (1 - fingerTip.x) * width; 
    const y = fingerTip.y * height;
    
    indexFingerTip = { x, y };
  } else {
    indexFingerTip = null;
  }
}