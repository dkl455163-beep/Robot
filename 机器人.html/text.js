
// 定义变量保存对话内容
let conversationHistory = [];
let isRecognizing = false;
let eventSource = null;

// 浏览器兼容性处理
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
    alert("当前浏览器不支持语音识别");
    throw new Error("Browser not supported");
}

// 语音识别模块对象
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = navigator.language || "zh-CN";

// DOM获取
const statusDom = document.getElementById("status");
const statusText = document.getElementById("statusText");
const responseContentDom = document.getElementById("responseContent");
const loading = document.querySelector('.loading');
const loadingContainer = document.querySelector('.loading-container');
const emojiDom = document.querySelector('.emoji');

// 语音合成对象
const utterance = new SpeechSynthesisUtterance();

// 重置emoji动画的函数
function resetEmojiAnimation() {
    emojiDom.style.animation = 'none';
    emojiDom.offsetHeight; // 触发重排
    emojiDom.style.animation = 'emoji-bounce 1.2s infinite ease-in-out';
}


// 开始识别
recognition.onstart = () => {
    isRecognizing = true;
    statusDom.classList.add("active");
    statusText.textContent = "聆听中...";
    emojiDom.textContent = "🤔";
    emojiDom.style.animation = "emoji-bounce 0.6s ease-in-out";
    resetEmojiAnimation();
};

// 语音识别自然结束
recognition.onend = () => {
    statusDom.classList.remove("active");
    statusText.textContent = "按住空格键开始说话";
    recognition.stop();
    isRecognizing = false;
    emojiDom.textContent = "🎉";
    emojiDom.style.animation = "emoji-bounce 0.6s ease-in-out";
    resetEmojiAnimation();
};

// 错误处理
recognition.onerror = (event) => {
    isRecognizing = false;
    console.error("识别错误：", event.error);
    recognition.stop();
    emojiDom.textContent = "⚠️";
    resetEmojiAnimation();

};

// 初始化语音合成函数
function initializeVoice() {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        const voice = voices.find(v =>
            v.name === 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)'
        );
        if (voice) {
            utterance.voice = voice;
            utterance.rate = 1.1;
            utterance.pitch = 0.8;
            utterance.volume = 0.9;
        }
    } else {
        console.log("未找到任何语音，等待onvoiceschanged事件...");
    }
}

// 监听语音列表加载事件
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = initializeVoice;
}
window.speechSynthesis.addEventListener('voiceschanged', initializeVoice);

// 语音播放函数
function applyVoice(text) {
    utterance.text = text;
    window.speechSynthesis.speak(utterance);
}

// 流式输出函数
function streamResponse(message) {
    // 关闭之前的连接
    if (eventSource) {
        eventSource.close();
    }

    // 显示加载动画
    loading.style.display = "flex";
    loadingContainer.classList.add("show");

    // 清空当前响应内容
    responseContentDom.innerHTML = "";

    // 创建新的EventSource连接
    eventSource = new EventSource(`http://127.0.0.1:8080/deepseek/chat/stream?message=${encodeURIComponent(message)}`);

    // 监听流式数据
    eventSource.onmessage = function (event) {
        responseContentDom.innerHTML += event.data;
    };

    // 连接结束
    eventSource.onerror = function (err) {
        eventSource.close();
        loading.style.display = "none";
        loadingContainer.classList.remove("show");

        // 获取完整的响应文本
        const fullResponse = responseContentDom.innerHTML;
        if (fullResponse) {
            // 添加到对话历史
            conversationHistory.push({
                role: "ai",
                content: fullResponse
            });

            // 清理文本并播放语音
            let cleanText = fullResponse
                .replace(/[#*>`\-=~]/g, "")
                .replace(/\d+\./g, "")
                .replace(/\n+/g, " ")
                .replace(/\s{2,}/g, " ")
                .replace(/[\u{1F600}-\u{1F9FF}]/gu, "")
                .replace(/[\u{2600}-\u{27BF}]/gu, "")
                .replace(/[\u{1F000}-\u{1F02F}]/gu, "")
                .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "")
                .replace(/[\u{1F100}-\u{1F64F}]/gu, "")
                .replace(/[\u{1F650}-\u{1F67F}]/gu, "")
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
                .replace(/[\u{1F700}-\u{1F77F}]/gu, "")
                .replace(/[\u{1F780}-\u{1F7FF}]/gu, "")
                .replace(/[\u{1F800}-\u{1F8FF}]/gu, "")
                .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
                .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
                .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？；：""''（）【】、]/g, "");

            applyVoice(cleanText);
        }
    };
}

// 获取结果
recognition.onresult = (event) => {
    const results = event.results;
    let finalTranscript = "";
    let interimTranscript = "";

    for (const result of results) {
        const transcript = result[0].transcript;
        if (result.isFinal) {
            finalTranscript += transcript;
        } else {
            interimTranscript += transcript;
        }
    }

    if (finalTranscript) {
        const cleanTranscript = finalTranscript.trim();

        // 添加到对话历史
        conversationHistory.push({
            role: "user",
            content: cleanTranscript
        });

        // 调用流式响应
        streamResponse(cleanTranscript);
    }
};

// 键盘事件监听
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isRecognizing) {
        recognition.start();
        e.preventDefault();
    }
});

document.addEventListener("keyup", (e) => {
    if (e.code === "Space" && isRecognizing) {
        recognition.stop();
    }
});
