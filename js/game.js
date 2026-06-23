const Game = {
    state: { hp: 100, sanit: 100, trust: 50, history: [], flags: {} },
    currentStageKey: null,
    currentSceneId: null, 
    clearedStages: [],
    
    timerInterval: null,
    timeLeft: 15,

    images: {
        black: "https://placehold.co/600x400/212121/ffffff?text=..."
    },

    init() {
        const saved = localStorage.getItem('lifeline_cleared');
        if (saved) this.clearedStages = JSON.parse(saved);
        this.switchScreen('home-screen');
    },

    toHome() { this.switchScreen('home-screen'); },
    
    toCredit() { this.switchScreen('credit-screen'); },
    
    toSelect() {
        if (typeof AudioSys !== 'undefined') {
            if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') {
                AudioSys.ctx.resume();
            } else {
                AudioSys.init();
            }
        }
        
        this.renderStageList();
        this.switchScreen('select-screen');
    },

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },

    renderStageList() {
        const list = document.getElementById('stage-list');
        list.innerHTML = '';
        Object.keys(ScenarioData).forEach(key => {
            const data = ScenarioData[key];
            const isCleared = this.clearedStages.includes(key);
            const card = document.createElement('div');
            card.className = `stage-card ${isCleared ? 'cleared' : ''}`;
            card.innerHTML = `
                <div class="badge-clear">CLEARED</div>
                <div class="stage-title">${data.title}</div>
                <div class="stage-desc">${data.desc}</div>
            `;
            card.onclick = () => this.startGame(key);
            list.appendChild(card);
        });
    },

    startGame(stageKey) {
        this.currentStageKey = stageKey;
        const stageData = ScenarioData[stageKey];
        this.state = { hp: 100, sanit: 100, trust: 50, history: [], flags: {} };
        this.updateStatusUI();

        document.getElementById('control-panel').classList.remove('result-mode');
        this.isProcessing = false;

        const bContent = document.getElementById('briefing-content');
        bContent.innerHTML = stageData.briefing || "（状況説明がありません）";
        this.switchScreen('briefing-screen');
    },

    startSceneAfterBriefing() {
        this.switchScreen('game-screen');
        this.renderScene(ScenarioData[this.currentStageKey].startScene);
    },

    startTimer() {
        this.clearTimer();
        this.timeLeft = 15;
        const timerContainer = document.getElementById('timer-container');
        timerContainer.style.display = 'block';
        this.updateTimerUI();

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();
            if (this.timeLeft <= 0) {
                this.handleTimeout();
            }
        }, 1000);
    },

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('timer-container').style.display = 'none';
    },

    updateTimerUI() {
        const bar = document.getElementById('timer-bar');
        const text = document.getElementById('timer-text');
        if(bar) bar.style.width = (this.timeLeft / 15 * 100) + '%';
        if(text) text.innerText = `${this.timeLeft}秒`;
    },

    handleTimeout() {
        this.clearTimer();
        if (this.isProcessing) return;
        
        const stageData = ScenarioData[this.currentStageKey];
        const scene = stageData.scenes[this.currentSceneId];
        
        let wrongOpt = scene.options.find(opt => !opt.fb.isGood);
        if (!wrongOpt) wrongOpt = scene.options[0]; 
        
        this.resolveOption(wrongOpt, true);
    },

    renderScene(sceneId) {
        this.currentSceneId = sceneId; 
        this.clearTimer(); 

        const stageData = ScenarioData[this.currentStageKey];
        const scene = stageData.scenes[sceneId];

        if (scene.isEnd) {
            this.finishGame();
            return;
        }

        document.getElementById('phase-badge').innerText = scene.phase || '---';
        document.getElementById('time-display').innerText = scene.time || '';
        document.getElementById('speaker').innerText = scene.speaker || 'SYSTEM';
        document.getElementById('dialogue-text').innerText = scene.text;

        const img = document.getElementById('scene-img');
        const alertEl = document.getElementById('overlay-alert');
        img.classList.remove('show', 'zoom', 'shake');
        alertEl.style.display = 'none';

        setTimeout(() => {
            img.src = scene.img || this.images.black;
            img.onload = () => {
                img.classList.add('show');
                if (scene.anim) img.classList.add(scene.anim);
                else img.classList.add('zoom');
            };
        }, 50);

        if (scene.alert) {
            alertEl.innerText = scene.alert;
            alertEl.style.display = 'block';
        }

        if (typeof AudioSys !== 'undefined' && scene.se) AudioSys.playSE(scene.se);

        const optsArea = document.getElementById('options-list');
        optsArea.innerHTML = '';

        if (scene.options) {
            scene.options.forEach(opt => {
                const btn = document.createElement('div');
                btn.className = 'option-btn';
                btn.innerText = opt.text;
                btn.onclick = () => this.resolveOption(opt);
                optsArea.appendChild(btn);
            });
            this.startTimer();
        } else if (scene.next) {
            const btn = document.createElement('div');
            btn.className = 'option-btn';
            btn.innerText = "次へ";
            btn.onclick = () => this.renderScene(scene.next);
            optsArea.appendChild(btn);
        }
    },

    resolveOption(opt, isTimeout = false) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.clearTimer(); 

        if(opt.hp) this.state.hp += opt.hp;
        if(opt.sanit) this.state.sanit += opt.sanit;
        if(opt.trust) this.state.trust += opt.trust;
        this.updateStatusUI();

        if (opt.fb) {
            this.state.history.push({ choice: isTimeout ? `【時間切れ】 ${opt.text}` : opt.text, fb: opt.fb });
            
            let fbType = 'bad';
            let msg = "BAD CHOICE...";
            let se = 'bad';
            let badgeColor = '#d32f2f';
            let badgeText = '危険';

            if (isTimeout || opt.fb.isWarning) {
                fbType = 'warning';
                msg = isTimeout ? "TIME UP!" : "CAUTION!";
                se = 'bad';
                badgeColor = '#f57c00';
                badgeText = isTimeout ? '時間切れ' : '注意';
            } else if (opt.fb.isGood) {
                fbType = 'good';
                msg = "GOOD CHOICE!";
                se = 'good';
                badgeColor = '#2e7d32';
                badgeText = '正解';
            }

            if (typeof AudioSys !== 'undefined') AudioSys.playSE(se);
            this.showToast(msg, fbType); 

            const optsArea = document.getElementById('options-list');
            let html = `
                <div class="fb-card ${fbType}" style="margin-top:0; padding:15px; box-shadow:none; border:2px solid ${badgeColor};">
                    <div class="fb-header">
                        <span>解説</span>
                        <span class="fb-badge" style="background:${badgeColor}">${badgeText}</span>
                    </div>
                    <div class="fb-text" style="font-weight:bold; margin-bottom:10px;">${opt.fb.reason}</div>
            `;

            if (!opt.fb.isGood) {
                if (opt.fb.ifWrong) {
                    html += `
                        <span class="fb-section-title" style="color:#d32f2f;">もし間違っていたら...</span>
                        <div class="fb-text">${opt.fb.ifWrong}</div>
                    `;
                }
                if (opt.fb.knowledge) {
                    html += `
                        <div class="fb-knowledge" style="margin-top:10px;">
                            <div class="fb-k-title" style="font-weight:bold; color:var(--primary);">深掘り知識</div>
                            <div class="fb-text">${opt.fb.knowledge}</div>
                        </div>
                    `;
                }
            }
            html += `</div>`;
            
            html += `<div class="option-btn" style="text-align:center; background:var(--header-bg); color:white; margin-top:10px;" id="btn-next-scene">次のシーンへ</div>`;
            
            optsArea.innerHTML = html;
            
            document.getElementById('btn-next-scene').onclick = () => {
                this.isProcessing = false;
                this.renderScene(opt.next);
            };

        } else {
            setTimeout(() => {
                this.renderScene(opt.next);
                this.isProcessing = false;
            }, 300); 
        }
    },

    updateStatusUI() {
        document.getElementById('val-hp').innerText = this.state.hp;
        document.getElementById('gauge-hp').style.width = Math.max(0, Math.min(100, this.state.hp)) + '%';
        document.getElementById('val-sanit').innerText = this.state.sanit;
        document.getElementById('gauge-sanit').style.width = Math.max(0, Math.min(100, this.state.sanit)) + '%';
        document.getElementById('val-trust').innerText = this.state.trust;
        document.getElementById('gauge-trust').style.width = Math.max(0, Math.min(100, this.state.trust)) + '%';
    },

    showToast(msg, type) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.className = `toast-${type}`; 
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    },

    finishGame() {
        if (!this.clearedStages.includes(this.currentStageKey)) {
            this.clearedStages.push(this.currentStageKey);
            localStorage.setItem('lifeline_cleared', JSON.stringify(this.clearedStages));
        }

        this.switchScreen('result-screen');
        document.getElementById('control-panel').classList.add('result-mode');

        const score = this.state.hp + this.state.sanit + this.state.trust;
        document.getElementById('final-score').innerText = score;
        
        let rank = "C";
        if (score >= 250) rank = "S (防災マスター)";
        else if (score >= 200) rank = "A (素晴らしい)";
        document.getElementById('rank-text').innerText = rank;

        const list = document.getElementById('feedback-list');
        list.innerHTML = '';

        this.state.history.forEach((h, i) => {
            let cardClass = 'bad';
            let badgeColor = '#d32f2f'; 
            let badgeText = '危険';
            
            if (h.choice.includes("【時間切れ】") || h.fb.isWarning) {
                cardClass = 'warning';
                badgeColor = '#f57c00'; 
                badgeText = h.choice.includes("【時間切れ】") ? '時間切れ' : '注意';
            } else if (h.fb.isGood) {
                cardClass = 'good';
                badgeColor = '#2e7d32'; 
                badgeText = '正解';
            }

            const div = document.createElement('div');
            div.className = `fb-card ${cardClass}`;
            
            let html = `
                <div class="fb-header">
                    <span>SCENE ${i+1}: ${h.fb.title}</span>
                    <span class="fb-badge" style="background:${badgeColor}">
                        ${badgeText}
                    </span>
                </div>
                <div class="fb-choice">あなたの選択：${h.choice}</div>
                <span class="fb-section-title">解説</span>
                <div class="fb-text">${h.fb.reason}</div>
            `;

            if (!h.fb.isGood && h.fb.ifWrong) {
                html += `
                    <span class="fb-section-title" style="color:#d32f2f;">もし間違っていたら...</span>
                    <div class="fb-text">${h.fb.ifWrong}</div>
                `;
            }

            if (h.fb.knowledge) {
                html += `
                    <div class="fb-knowledge">
                        <div class="fb-k-title">深掘り知識</div>
                        <div class="fb-text">${h.fb.knowledge}</div>
                    </div>
                `;
            }
            div.innerHTML = html;
            list.appendChild(div);
        });

        // ▼追加：ステージごとの総評を表示する機能
        const stageData = ScenarioData[this.currentStageKey];
        if (stageData.summary) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'fb-card';
            // 青色の枠線と薄い青背景で目立たせる
            summaryDiv.style.border = "2px solid #1976d2";
            summaryDiv.style.backgroundColor = "#e3f2fd";
            summaryDiv.innerHTML = `
                <div class="fb-text" style="line-height: 1.8; color: #0d47a1;">
                    ${stageData.summary}
                </div>
            `;
            list.appendChild(summaryDiv);
        }
    }
};

// ゲーム初期化
Game.init();
