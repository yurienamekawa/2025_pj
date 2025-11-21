// --- 1. 必要なライブラリのインポート ---
// MediaPipe（GoogleのAIライブラリ）をCDNから直接読み込みます
import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// --- 2. 変数の定義 ---
let handLandmarker = undefined; // 手を検出するAIモデルを入れる変数
let capture;       // Webカメラの映像データを入れる変数
let canvasWidth = 640;  // キャンバスの横幅
let canvasHeight = 480; // キャンバスの高さ

// 人差し指の先端座標を保存する変数（初期値はnull）
// { x: 100, y: 200 } のようなオブジェクトが入ります
let indexFingerTip = null; 


// --- 3. p5.jsのセットアップ関数 (起動時に1回だけ実行) ---
// type="module"を使っているため、windowオブジェクトに明示的に代入します
window.setup = async function() {
  // キャンバス（お絵かきエリア）を作成
  createCanvas(canvasWidth, canvasHeight);
  
  // Webカメラの映像取得を開始
  capture = createCapture(VIDEO);
  capture.size(canvasWidth, canvasHeight);
  capture.hide(); // 映像そのもののHTML要素は隠す（キャンバスの中に描画するため）

  console.log("カメラを起動しました...");

  // MediaPipe（AIモデル）の準備を開始
  // 準備には数秒かかるので await で完了を待ちます
  await createHandLandmarker();
  
  console.log("AIモデルの準備完了！検出を開始します。");
};


// --- 4. p5.jsの描画ループ関数 (1秒間に約60回実行される) ---
window.draw = function() {
  background(0); // 画面を黒でリセット

  // カメラ映像の準備ができているか確認
  if (capture && capture.loadedmetadata) {
    
    // A. カメラ映像の描画（鏡のように反転させる処理）
    push(); // 設定を一時保存
    translate(width, 0); // 原点を右端に移動
    scale(-1, 1); // 左右を反転（ミラーリング）
    // 映像をキャンバスいっぱいに描画
    image(capture, 0, 0, width, height);
    pop(); // 設定を元に戻す

    // B. 手の検出処理を実行
    detectHands();
    
    // C. 検出結果（人差し指）があった場合の処理
    if (indexFingerTip) {
      // --- ここにマーカーの描画処理 ---
      fill(255, 0, 255); // 色：ピンク (R, G, B)
      noStroke();        // 線なし
      
      // 指先の位置に円を描く
      // indexFingerTip.x, .y には計算済みの画面座標が入っています
      ellipse(indexFingerTip.x, indexFingerTip.y, 20, 20);
      
      // テキストで座標を表示（デバッグ用）
      fill(255);
      textSize(16);
      text(`x: ${Math.floor(indexFingerTip.x)}, y: ${Math.floor(indexFingerTip.y)}`, 10, 30);
    }
  } else {
    // カメラ準備中の表示
    fill(255);
    textAlign(CENTER);
    text("カメラとAIを起動中...", width/2, height/2);
  }
};


// --- 5. MediaPipeの初期化関数 ---
async function createHandLandmarker() {
  // AIモデルの読み込みに必要なファイルを解決する
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  
  // 手認識モデルの設定と作成
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      // 学習済みモデルのファイルを指定
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU" // GPUを使って高速化する（PC推奨）
    },
    runningMode: "VIDEO", // 動画モードで動作
    numHands: 1 // 検出する手の最大数（今回は1つでOK）
  });
}


// --- 6. 手の検出を実行する関数 ---
async function detectHands() {
  // AIモデルまたはカメラ映像がまだ無ければ何もしない
  if (!handLandmarker || !capture.elt) return;

  // 現在の映像フレームから手を検出する
  // millis() はプログラム開始からの経過時間
  const results = handLandmarker.detectForVideo(capture.elt, millis());

  // 手が見つかった場合
  if (results.landmarks && results.landmarks.length > 0) {
    // 1つ目の手（配列の0番目）のデータを取得
    const hand = results.landmarks[0];
    
    // MediaPipeの手のキーポイント番号
    // 8番 = 人差し指の先端 (Index Finger Tip)
    const fingerTip = hand[8];
    
    // 【重要】座標の変換
    // MediaPipeは 0.0 〜 1.0 の正規化された値（割合）で座標を返します。
    // 画面上のピクセル位置にするには、幅と高さを掛け算する必要があります。
    // また、描画時に「左右反転」しているため、X座標は「1 - x」で反転させます。
    const x = (1 - fingerTip.x) * width; 
    const y = fingerTip.y * height;

    // グローバル変数に保存
    indexFingerTip = { x, y };
    
  } else {
    // 手が見つからない場合はnullにする
    indexFingerTip = null;
  }
}