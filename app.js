document.addEventListener('DOMContentLoaded', () => {
    // Check if SpeechRecognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert("很抱歉，您的瀏覽器不支援 Web Speech API。請使用最新版的 Google Chrome 瀏覽器。");
        return;
    }

    // Elements
    const recordBtn = document.getElementById('recordBtn');
    const btnText = document.getElementById('btnText');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const languageSelect = document.getElementById('languageSelect');
    const finalTextSpan = document.getElementById('finalText');
    const interimTextSpan = document.getElementById('interimText');
    const placeholderText = document.getElementById('placeholderText');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');

    // State
    let isRecording = false;
    let recognition = new SpeechRecognition();
    let finalTranscript = '';
    let shouldAutoRestart = false; // Used for continuous recording
    let mediaRecorder = null;
    let audioChunks = [];
    let audioStream = null;
    let recordingStartTime = null;

    // Recognition Configuration
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageSelect.value;

    // Update language when changed
    languageSelect.addEventListener('change', (e) => {
        recognition.lang = e.target.value;
        if (isRecording) {
            // Restart recognition to apply new language
            stopRecording();
            setTimeout(startRecording, 300);
        }
    });

    // Toggle Recording
    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            // Clear previous text for a new recording session
            finalTranscript = '';
            finalTextSpan.textContent = '';
            interimTextSpan.textContent = '';
            startRecording();
        }
    });

    async function startRecording() {
        try {
            // Request microphone access for MediaRecorder
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup Media Recorder
            mediaRecorder = new MediaRecorder(audioStream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const downloadAudioBtn = document.getElementById('downloadAudioBtn');
                downloadAudioBtn.href = audioUrl;
                downloadAudioBtn.download = `錄音檔_${new Date().getTime()}.webm`;
                downloadAudioBtn.style.display = 'flex';
            };
            
            mediaRecorder.start();
            recordingStartTime = Date.now();
            
            // Setup and start Speech Recognition
            shouldAutoRestart = true;
            recognition.start();
            
            isRecording = true;
            recordBtn.classList.add('recording');
            btnText.textContent = "停止錄音";
            
            statusIndicator.classList.add('recording');
            statusIndicator.classList.remove('error');
            statusText.textContent = "正在聆聽中...";
            
            placeholderText.style.display = 'none';
            document.getElementById('downloadAudioBtn').style.display = 'none'; // Hide previous download btn

        } catch (error) {
            console.error("Recording start error:", error);
            if (error.name === 'NotAllowedError') {
                statusText.textContent = "錯誤：請允許麥克風權限";
            } else {
                statusText.textContent = "發生錯誤：" + error.message;
            }
            statusIndicator.classList.add('error');
            statusIndicator.classList.remove('recording');
        }
    }

    function stopRecording() {
        shouldAutoRestart = false;
        recognition.stop();
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }
        
        resetUI();
    }

    function resetUI() {
        isRecording = false;
        recordBtn.classList.remove('recording');
        btnText.textContent = "開始錄音";
        
        statusIndicator.classList.remove('recording');
        statusIndicator.classList.remove('error');
        statusText.textContent = "系統就緒，點擊下方按鈕開始";
    }

    // Recognition Events
    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                let timeString = "00:00";
                if (recordingStartTime) {
                    const diff = Date.now() - recordingStartTime;
                    const totalSeconds = Math.floor(diff / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    if (hours > 0) {
                        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    } else {
                        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }
                }
                finalTranscript += `[${timeString}] ${transcript}<br>`; 
            } else {
                interimTranscript += transcript;
            }
        }

        // Update UI
        finalTextSpan.innerHTML = finalTranscript;
        interimTextSpan.textContent = interimTranscript;
        
        // Update Word Download Link dynamically
        updateWordDownloadLink();
        
        // Auto scroll to bottom with a slight delay to ensure DOM is updated
        setTimeout(() => {
            const transcriptBox = document.getElementById('transcriptBox');
            transcriptBox.scrollTop = transcriptBox.scrollHeight;
        }, 10);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            statusText.textContent = "錯誤：請允許麥克風權限";
            shouldAutoRestart = false;
        } else if (event.error === 'network') {
            statusText.textContent = "錯誤：網路連線問題";
        } else if (event.error === 'no-speech') {
            // Ignore no-speech, it happens when quiet
            return;
        } else {
            statusText.textContent = "發生錯誤：" + event.error;
        }
        statusIndicator.classList.add('error');
        statusIndicator.classList.remove('recording');
    };

    recognition.onend = () => {
        // Auto-restart if we didn't explicitly stop it (for continuous listening)
        if (shouldAutoRestart) {
            setTimeout(() => {
                try {
                    // Only start if we are still supposed to be recording
                    if (shouldAutoRestart) {
                        recognition.start();
                    }
                } catch (error) {
                    console.error("Auto-restart error:", error);
                }
            }, 300); // 300ms delay is critical for Chrome to properly restart the engine
        } else {
            resetUI();
        }
    };

    // Actions
    clearBtn.addEventListener('click', () => {
        finalTranscript = '';
        finalTextSpan.textContent = '';
        interimTextSpan.textContent = '';
        if (!isRecording) {
            placeholderText.style.display = 'block';
        }
    });

    copyBtn.addEventListener('click', async () => {
        const textToCopy = finalTranscript + interimTextSpan.textContent;
        if (!textToCopy.trim()) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981"><polyline points="20 6 9 17 4 12"></polyline></svg>
                已複製
            `;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('複製失敗，請手動圈選複製。');
        }
    });

    // --- Word Export (Dynamic Link for iOS Compatibility) ---
    let currentWordUrl = null;
    const downloadWordBtn = document.getElementById('downloadWordBtn');
    
    function updateWordDownloadLink() {
        const rawContent = finalTranscript + interimTextSpan.textContent;
        if (!rawContent.replace(/<br>/g, '').trim()) {
            downloadWordBtn.removeAttribute('href');
            downloadWordBtn.removeAttribute('download');
            return;
        }

        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + `<p style="font-family: Arial, sans-serif; font-size: 14pt; line-height: 1.5;">${rawContent}</p>` + footer;
        
        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        
        if (currentWordUrl) {
            URL.revokeObjectURL(currentWordUrl);
        }
        currentWordUrl = URL.createObjectURL(blob);
        
        downloadWordBtn.href = currentWordUrl;
        downloadWordBtn.download = `語音紀錄_${new Date().getTime()}.doc`;
    }
    
    // Add click listener just to alert if empty
    downloadWordBtn.addEventListener('click', (e) => {
        if (!downloadWordBtn.getAttribute('href')) {
            e.preventDefault();
            alert('沒有可匯出的文字！');
        }
    });

});
