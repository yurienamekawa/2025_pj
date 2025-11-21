import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// -------------------------------------------------------------
// ★ここに取得したAPIキーを貼り付けてください！
const API_KEY = "APIキーをここに貼り付け"; 
// -------------------------------------------------------------

let handLandmarker = undefined;
let capture;
let indexFingerTip = null;

// 軌跡データ
let history = []; 
const MAX_HISTORY = 60; 
let cooldown = 0; 

// 音声認識・AI関連
let recognition;        
let isListening = false; 
let recognizedText = ""; 

window.setup = async function() {
  createCanvas(windowWidth, windowHeight);
  
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  await createHandLandmarker();
  setupSpeechRecognition();

  console.log("システム準備完了: APIキー設定済み");
};

window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

window.draw = function() {
  background(0); // 黒背景

  if (cooldown > 0) cooldown--;

  if (capture && capture.loadedmetadata) {
    detectHands();

    // 軌跡のデータ更新
    if (indexFingerTip) {
      history.unshift({ x: indexFingerTip.x, y: indexFingerTip.y });
      if (history.length > MAX_HISTORY) history.pop();
    }

    // 指先（ピンク）の描画
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
      startListening(); 
      cooldown = 120;   
      history = [];     
    }
  }

  drawUI();
};

// UI描画
function drawUI() {
  textAlign(CENTER, CENTER);
  noStroke();

  if (isListening) {
    fill(255, 100, 100);
    textSize(40);
    text("聞いています...", width / 2, height / 2);
    
    let pulse = map(sin(millis() / 200), -1, 1, 10, 20);
    ellipse(width / 2, height / 2 + 50, 20 + pulse, 20 + pulse);
  } 
  else if (recognizedText !== "") {
    fill(255);
    textSize(32);
    text(`認識: 「${recognizedText}」`, width / 2, height / 2);
    
    textSize(16);
    fill(150);
    text("AIがパラメータ生成中... (コンソールを見てね)", width / 2, height / 2 + 50);
  }
}

// --- 音声認識の設定 ---
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("このブラウザは音声認識に対応していません。");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP'; 
  recognition.interimResults = false; 
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    recognizedText = ""; 
  };

  recognition.onend = () => {
    isListening = false;
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    recognizedText = transcript;
    console.log("認識結果:", transcript);
    
    // ★ここでGeminiを呼び出します！
    const params = await callGemini(transcript);
    
    if (params) {
        console.log("★★★ AIからの設計図(JSON)を受信しました！ ★★★");
        console.log(params);
        // Step 5でここに描画処理を追加します
    }
  };
}

function startListening() {
  if (recognition && !isListening) {
    try { recognition.start(); } catch (e) { console.error(e); }
  }
}

// --- Gemini API呼び出し関数 (Gemini 2.0 Flash版) ---
async function callGemini(text) {
  console.log("Geminiに問い合わせ中...", text);
  
  if (!API_KEY || API_KEY.includes("ここに")) {
      console.error("エラー: APIキーが設定されていません。");
      return null;
  }

  // ★修正: あなたのリストにあった 'gemini-2.0-flash' を指定
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const prompt = `
    あなたはジェネレーティブ・アートのパラメータ生成エンジンです。
    ユーザーの入力: 「${text}」
    この入力から連想される「架空の花」の視覚的特徴を決定し、以下のJSONフォーマットのみを出力してください。
    Markdownのコードブロックや余計な説明は一切不要です。純粋なJSON文字列だけを返してください。

    {
      "color_hex": "#RRGGBB形式のカラーコード (例: #FF00FF)",
      "center_color_hex": "#RRGGBB形式の中心の色",
      "petal_count": 3〜12の整数 (花びらの枚数),
      "petal_radius": 50〜150の整数 (花びらの長さ),
      "petal_width": 10〜50の整数 (花びらの太さ),
      "layer_count": 1〜3の整数 (花びらの重なり数)
    }
  `;

  const data = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API エラー詳細:", errorData);
        return null;
    }

    const json = await response.json();
    console.log("AIからの返答(生データ):", json); 

    const resultText = json.candidates[0].content.parts[0].text;
    const cleanJsonText = resultText.replace(/```json|```/g, "").trim();
    
    const params = JSON.parse(cleanJsonText);
    
    // ★成功の証としてコンソールに目立つように表示
    console.log("%c🌸 JSON取得成功！ 🌸", "color: pink; font-size: 20px; background: black;");
    console.log(params);

    return params;

  } catch (error) {
    console.error("通信または解析エラー:", error);
    return null;
  }
}

// --- MediaPipe & 円判定 ---
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

// --- 使えるモデルを調べる診断コード ---
// script.jsの最後に貼り付けて保存してください
(async function listModels() {
  console.log("🔍 使えるモデルを検索中...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ 成功！あなたのキーで使えるモデル一覧はこちら:");
      
      // 使えるモデルの名前だけをリストアップして表示
      const modelNames = data.models.map(m => m.name);
      console.log(modelNames);
      
      // おすすめのモデルがあるかチェック
      const recommended = modelNames.find(name => name.includes("gemini-1.5-flash"));
      if (recommended) {
        console.log(`💡 これを使ってください 👉 "${recommended.replace('models/', '')}"`);
      }
    } else {
      console.error("❌ エラー:", data);
    }
  } catch (e) {
    console.error("通信エラー:", e);
  }
})();