// ----- ↓↓↓ ここに変数宣言が必要です ↓↓↓ -----
// Webカメラの映像を保持する変数
let capture;
// MediaPipeから受け取った手の位置情報を保持する変数
let handLandmarks;
// 指の軌跡を記録するための配列
let path = [];
// 音声認識中かどうかを管理するフラグ
let isRecognizing = false;
// ----- ↑↑↑ この部分が消えていたのが原因です ↑↑↑ -----

const GEMINI_API_KEY = "ここに取得したAPIキーを貼り付け";


// setup()関数：プログラムが起動したときに一度だけ実行される
function setup() {
  createCanvas(800, 600);
  // ここでcapture変数にカメラ映像を代入します
  capture = createCapture(VIDEO);
  capture.size(800, 600);
  capture.hide();

  const videoElement = document.getElementById('webcam');
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  hands.onResults(onResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: capture.elt }); },
    width: 800,
    height: 600
  });
  camera.start();
}

function onResults(results) {
  handLandmarks = results.multiHandLandmarks;
}

// draw()関数：繰り返しずっと実行される
function draw() {
  translate(width, 0);
  scale(-1, 1);
  // capture変数を使ってカメラ映像を描画します
  image(capture, 0, 0, width, height);
  
  if (handLandmarks && handLandmarks.length > 0) {
    const landmarks = handLandmarks[0];
    const indexFingerTip = landmarks[8];
    const x = indexFingerTip.x * width;
    const y = indexFingerTip.y * height;

    path.push({ x, y });
    if (path.length > 50) {
      path.shift();
    }
    checkForCircleGesture();
    
    fill(255, 255, 0);
    noStroke();
    circle(x, y, 20);

    stroke(255, 255, 0, 150);
    strokeWeight(4);
    noFill();
    beginShape();
    for (let point of path) {
      vertex(point.x, point.y);
    }
    endShape();
  } else {
    path = [];
  }
}

// 円を描いたかどうかを判定する関数
function checkForCircleGesture() {
  if (path.length < 40 || isRecognizing) return;

  const startPoint = path[0];
  const endPoint = path[path.length - 1];
  const distance = dist(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

  if (distance < 50) {
    console.log("円ジェスチャーを検出！");
    startSpeechRecognition();
    path = [];
  }
}

// 音声認識を開始する関数
function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("お使いのブラウザは音声認識に対応していません。");
    return;
  }

  isRecognizing = true;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  console.log("音声認識を開始します。話してください...");

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("認識結果:", transcript);
    callGeminiAPI(transcript);
  };

  recognition.onerror = (event) => {
    console.error("音声認識エラー:", event.error);
    isRecognizing = false;
  };
  
  recognition.onend = () => {
    console.log("音声認識を終了します。");
  };

  recognition.start();
}

// Gemini APIを呼び出す関数
async function callGeminiAPI(userInput) {
  console.log("Gemini APIを呼び出します...");
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`;

  const prompt = `
    ユーザーの言葉「${userInput}」から連想される、ユニークな花の特徴をJSON形式で出力してください。
    以下のパラメータを含めてください。
    - "mainColor": 花の主要な色 (例: "深い紫色")
    - "centerColor": 花の中心の色 (例: "淡い黄色")
    - "shape": 花びらの形 (例: "星形", "ベル形", "円形")
    - "petalCount": 花びらの枚数 (3から8の間の整数)
    - "stemStyle": 茎の様子 (例: "しなやかにカーブ", "まっすぐ")
    - "decoration": 追加の装飾 (例: "花びらの先に光の粒", "朝露に濡れている")
    
    JSONデータのみを返してください。説明は不要です。
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`APIリクエストに失敗しました: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const designPlanText = data.candidates[0].content.parts[0].text;
    const designPlan = JSON.parse(designPlanText.replace(/```json|```/g, ''));
    
    console.log("AIからの設計図:", designPlan);
    alert("AIから花の設計図を受け取りました！コンソールを確認してください。");

  } catch (error) {
    console.error("Gemini APIエラー:", error);
    alert("AIとの通信に失敗しました。");
  } finally {
    isRecognizing = false;
  }
}