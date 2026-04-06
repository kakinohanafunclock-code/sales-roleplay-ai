import * as THREE from 'three';

// ============================================
// グローバル変数
// ============================================
// APIキーはサーバー側で管理（クライアント側では不要）
let recognition = null;
let synthesis = window.speechSynthesis;
let isRecording = false;
let conversationHistory = [];

let roleplaySettings = {
    difficulty: null,
    industry: null,
    scene: null
};

// Three.js関連
let scene, camera, renderer, avatar, clock, animationId;
let isSpeaking = false;
let currentEmotion = 'neutral';

// 感情マッピング
const emotionMap = {
    'neutral': { emoji: '😐', label: '通常', color: 0x8b9dc3 },
    'happy': { emoji: '😊', label: '好意的', color: 0x4caf50 },
    'sad': { emoji: '😔', label: '困惑', color: 0x2196f3 },
    'angry': { emoji: '😠', label: '不満', color: 0xf44336 },
    'surprised': { emoji: '😲', label: '驚き', color: 0xff9800 }
};

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initSpeechRecognition();
    initSetupScreen();
    initChatScreen();
    
    // 最初から設定画面を表示
    document.getElementById('setupScreen').classList.remove('hidden');
});

// ============================================
// 設定画面（APIキー入力不要）
// ============================================
function initSetupScreen() {
    // オプション選択
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const value = btn.dataset.value;

            // 同じグループの選択を解除
            document.querySelectorAll(`[data-type="${type}"]`).forEach(b => {
                b.classList.remove('selected');
            });

            // 選択
            btn.classList.add('selected');
            roleplaySettings[type] = value;

            // すべて選択されたらボタン有効化
            checkStartButton();
        });
    });

    // 開始ボタン
    document.getElementById('startBtn').addEventListener('click', startRoleplay);
}

function checkStartButton() {
    const allSelected = roleplaySettings.difficulty && 
                      roleplaySettings.industry && 
                      roleplaySettings.scene;
    
    document.getElementById('startBtn').disabled = !allSelected;
}

// ============================================
// 対話画面
// ============================================
function initChatScreen() {
    document.getElementById('micBtn').addEventListener('click', toggleRecording);
    document.getElementById('resetBtn').addEventListener('click', resetToSetup);
}

async function startRoleplay() {
    // 画面切り替え
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');

    // タグ表示
    document.getElementById('difficultyTag').textContent = `難易度: ${roleplaySettings.difficulty}`;
    document.getElementById('industryTag').textContent = roleplaySettings.industry;
    document.getElementById('sceneTag').textContent = roleplaySettings.scene;

    // 3Dアバター初期化
    await init3DAvatar();

    // システムプロンプト設定
    const systemPrompt = createSystemPrompt();
    conversationHistory = [{ role: 'user', content: systemPrompt }];

    // 最初のAI応答を取得
    updateStatus('AIが最初の発言を準備中...');
    callClaudeAPI();
}

function createSystemPrompt() {
    return `あなたは「SES営業のロールプレイ相手」兼「営業トークのコーチ」です。

【あなたの役割】
1. SES営業の顧客役としてリアルに振る舞う
2. 会話途中でも営業トーク改善アドバイスを返す
3. 質問型営業を活用して営業スキルを上げる

【参考情報：私の会社】
・SES企業、インフラ運用保守監視・第三者検証が得意
・採用力が強く、ロースキル人材も在籍
・求める顧客条件: 単価が高い、自社エンジニアで体制を組める、ロースキル要員でもアサイン可能

【ロールプレイ設定】
- 難易度: ${roleplaySettings.difficulty}
- 顧客の業界: ${roleplaySettings.industry}
- シーン: ${roleplaySettings.scene}

【あなたに求める振る舞い】
●顧客役として
- 実際のSIer/SES企業の営業先のようにリアルに振る舞う
- 質問の質によって少しずつ情報開示
- 難易度に応じた対応

●営業コーチとして
《アドバイス》
- 良かった点：
- 改善点：
- 次の一手：

【参考動画の営業手法】
- いきなり提案しない
- 質問で現状・課題・理想を引き出す
- ニーズを言語化させる
- 相手の言葉で価値を語らせる

【返答ルール】
必ず2部構成：
1. 顧客としての返答（音声化されます）
2. 営業アドバイス

《アドバイス》
- 良かった点：
- 改善点：
- 次の一手：

[感情: neutral / happy / sad / angry / surprised]

それでは、顧客役として最初の一言をお願いします。シーンは「${roleplaySettings.scene}」です。`;
}

// ============================================
// 3Dアバター初期化（VRMモデル使用）
// ============================================
async function init3DAvatar() {
    const canvas = document.getElementById('avatarCanvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // シーン作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // カメラ
    camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 1.4, -2.5); // Z座標を負の値に変更
    camera.lookAt(0, 1.3, 0);

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // レンダラー
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Clock
    clock = new THREE.Clock();

    // VRMモデルを読み込む
    await loadVRMModel();

    // アニメーション開始
    animate();

    // リサイズ対応
    window.addEventListener('resize', onWindowResize);
}

async function loadVRMModel() {
    try {
        updateAvatarInfo('VRMモデル読み込み中...');

        // GLTFLoaderとVRMLoaderPluginを動的インポート
        const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
        const { VRMLoaderPlugin } = await import('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2.1.0/lib/three-vrm.module.js');

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        // modelsディレクトリ内のVRMファイルを読み込む
        // ファイル名を適切に変更してください
        const vrmPath = 'models/avatar.vrm'; // ← ここを実際のファイル名に変更

        const gltf = await new Promise((resolve, reject) => {
            loader.load(
                vrmPath,
                resolve,
                (progress) => {
                    if (progress.total > 0) {
                        const percent = Math.floor((progress.loaded / progress.total) * 100);
                        updateAvatarInfo(`読み込み中 ${percent}%`);
                    }
                },
                reject
            );
        });

        // VRMインスタンスを取得
        const vrm = gltf.userData.vrm;
        
        if (!vrm) {
            throw new Error('VRMデータが見つかりません');
        }

        scene.add(vrm.scene);
        
        // VRMモデルを保存（グローバル変数）
        window.currentVRM = vrm;

        updateAvatarInfo('✓ VRMアバター準備完了');

    } catch (error) {
        console.error('VRM読み込みエラー:', error);
        updateAvatarInfo('⚠ VRM読み込み失敗 - 簡易アバターで代替');
        
        // VRM読み込み失敗時は簡易アバターを使用
        createSimpleAvatar();
    }
}

function updateAvatarInfo(text) {
    const info = document.getElementById('avatarInfo');
    if (info) info.textContent = text;
}

function createSimpleAvatar() {
    const avatarGroup = new THREE.Group();

    // 頭
    const headGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    avatarGroup.add(head);

    // 目（左）
    const eyeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.55, 0.25);
    avatarGroup.add(leftEye);

    // 目（右）
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.55, 0.25);
    avatarGroup.add(rightEye);

    // 口
    const mouthGeometry = new THREE.TorusGeometry(0.08, 0.02, 16, 32, Math.PI);
    const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 1.35, 0.25);
    mouth.rotation.x = Math.PI;
    avatarGroup.add(mouth);

    // 体
    const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x4a5568 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    avatarGroup.add(body);

    avatar = avatarGroup;
    scene.add(avatar);
}

function animate() {
    animationId = requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // VRMモデルが読み込まれている場合
    if (window.currentVRM) {
        const vrm = window.currentVRM;

        // 口パク処理
        if (isSpeaking && vrm.expressionManager) {
            const time = Date.now() * 0.01;
            const mouthValue = (Math.sin(time) + 1) * 0.3;
            try {
                vrm.expressionManager.setValue('aa', mouthValue);
            } catch (e) {
                console.warn('口パク設定エラー:', e);
            }
        } else if (vrm.expressionManager) {
            try {
                vrm.expressionManager.setValue('aa', 0);
            } catch (e) {}
        }

        // VRM更新
        vrm.update(delta);
    }
    // 簡易アバターの場合
    else if (avatar) {
        const time = clock.getElapsedTime();
        // ゆっくり浮遊
        avatar.position.y = Math.sin(time * 2) * 0.02;
        // 左右に揺れる
        avatar.rotation.y = Math.sin(time * 0.5) * 0.05;

        // 口パク
        if (isSpeaking && avatar.children[3]) {
            avatar.children[3].scale.y = 1 + Math.sin(time * 10) * 0.1;
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    const canvas = document.getElementById('avatarCanvas');
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

// ============================================
// 表情変更（VRM対応）
// ============================================
function setExpression(emotion) {
    currentEmotion = emotion;
    const emotionData = emotionMap[emotion] || emotionMap['neutral'];

    // 表情インジケーター更新
    const indicator = document.getElementById('emotionIndicator');
    if (indicator) {
        indicator.textContent = `${emotionData.emoji} ${emotionData.label}`;
    }

    // VRMモデルの表情変更
    if (window.currentVRM && window.currentVRM.expressionManager) {
        const vrm = window.currentVRM;
        
        // すべての表情をリセット
        ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'fun'].forEach(exp => {
            try {
                vrm.expressionManager.setValue(exp, 0);
            } catch (e) {}
        });

        // 指定表情を適用
        try {
            vrm.expressionManager.setValue(emotionData.expression, 1.0);
        } catch (e) {
            console.warn(`表情 ${emotionData.expression} が見つかりません`);
        }
    }
    // 簡易アバターの体の色を変更
    else if (avatar && avatar.children[4]) {
        avatar.children[4].material.color.setHex(emotionData.color);
    }

    console.log(`表情変更: ${emotion} → ${emotionData.label}`);
}

// ============================================
// 音声認識
// ============================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('音声認識がサポートされていません');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleUserSpeech(transcript);
    };

    recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
        updateStatus('音声認識エラーが発生しました');
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!recognition) {
        const text = prompt('音声認識が使えません。テキストを入力してください：');
        if (text) handleUserSpeech(text);
        return;
    }

    isRecording = true;
    document.getElementById('micBtn').classList.add('recording');
    updateStatus('🎤 録音中... 話してください');

    recognition.start();
}

function stopRecording() {
    isRecording = false;
    document.getElementById('micBtn').classList.remove('recording');
    updateStatus('マイクボタンを押して話す');

    try {
        recognition.stop();
    } catch (e) {
        // 既に停止している場合のエラーを無視
    }
}

// ============================================
// ユーザー発話処理
// ============================================
function handleUserSpeech(text) {
    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    updateStatus('AI が考えています...');
    callClaudeAPI();
}

// ============================================
// Claude API呼び出し（Netlify Functions経由）
// ============================================
async function callClaudeAPI() {
    try {
        // Netlify Functionsのエンドポイント
        const PROXY_URL = '/.netlify/functions/claude-proxy';

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: conversationHistory,
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }

        const data = await response.json();
        
        const fullText = data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');

        const { customerResponse, advice, emotion } = parseAIResponse(fullText);

        conversationHistory.push({
            role: 'assistant',
            content: fullText
        });

        setExpression(emotion);
        addMessage('ai', customerResponse, advice);
        speakText(customerResponse);
        updateStatus('マイクボタンを押して話す');

    } catch (error) {
        console.error('Claude API Error:', error);
        updateStatus('エラーが発生しました');
        addMessage('ai', `エラー: ${error.message}\n\nプロキシサーバーが起動しているか確認してください。`);
    }
}

function parseAIResponse(text) {
    const emotionMatch = text.match(/\[感情:\s*(neutral|happy|sad|angry|surprised)\]/i);
    const emotion = emotionMatch ? emotionMatch[1].toLowerCase() : 'neutral';
    text = text.replace(/\[感情:\s*(neutral|happy|sad|angry|surprised)\]/gi, '').trim();

    const parts = text.split(/《アドバイス》/);
    let customerResponse = parts[0].trim();
    let advice = parts.length > 1 ? '《アドバイス》\n' + parts[1].trim() : null;

    return { customerResponse, advice, emotion };
}

// ============================================
// メッセージ表示
// ============================================
function addMessage(type, text, advice = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const label = type === 'user' ? 'あなた（営業）' : '顧客（AI）';
    
    messageDiv.innerHTML = `
        <div class="message-label">${label}</div>
        <div class="message-bubble">${text}</div>
    `;

    if (advice) {
        const adviceDiv = document.createElement('div');
        adviceDiv.className = 'advice-box';
        adviceDiv.innerHTML = formatAdvice(advice);
        messageDiv.appendChild(adviceDiv);
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatAdvice(adviceText) {
    const lines = adviceText.split('\n').filter(line => line.trim());
    let html = '<h4>💡 営業コーチからのアドバイス</h4><ul>';

    lines.forEach(line => {
        if (line.trim() && !line.includes('《アドバイス》')) {
            html += `<li>${line.replace(/^[-・]\s*/, '')}</li>`;
        }
    });

    html += '</ul>';
    return html;
}

// ============================================
// 音声合成
// ============================================
function speakText(text) {
    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthesis.getVoices();
    const japaneseVoice = voices.find(voice => voice.lang.startsWith('ja'));
    if (japaneseVoice) {
        utterance.voice = japaneseVoice;
    }

    utterance.onstart = () => { isSpeaking = true; };
    utterance.onend = () => { isSpeaking = false; };

    synthesis.speak(utterance);
}

function updateStatus(text) {
    document.getElementById('statusText').textContent = text;
}

// ============================================
// リセット
// ============================================
function resetToSetup() {
    if (confirm('設定画面に戻りますか？現在の会話内容は失われます。')) {
        synthesis.cancel();
        
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        document.getElementById('chatScreen').classList.add('hidden');
        document.getElementById('setupScreen').classList.remove('hidden');

        conversationHistory = [];
        document.getElementById('chatMessages').innerHTML = '';
        
        if (isRecording) {
            stopRecording();
        }
    }
}

// ============================================
// 音声合成の初期化
// ============================================
if (synthesis.onvoiceschanged !== undefined) {
    synthesis.onvoiceschanged = () => {
        synthesis.getVoices();
    };
}
