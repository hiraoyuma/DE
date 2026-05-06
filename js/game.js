const Game = {
    state: { hp: 100, sanit: 100, trust: 50, history: [], flags: {} },
    currentStageKey: null,
    clearedStages: [],
    
    // 画像プレースホルダー
    images: {
        black: "https://placehold.co/600x400/212121/ffffff?text=..."
    },

    init() {
        const saved = localStorage.getItem('lifeline_cleared');
        if (saved) this.clearedStages = JSON.parse(saved);
        this.switchScreen('home-screen');
    },

    toHome() { this.switchScreen('home-screen'); },
    
    toSelect() {
        // ボタンクリック時にAudioコンテキストを再開/初期化
        if(AudioSys && AudioSys.ctx && AudioSys.ctx.state === 'suspended'){
            AudioSys.ctx.resume();
        } else {
            AudioSys.init();
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

        // 2周目バグ修正：コントロールパネルの「全画面モード」を解除して元のサイズに戻す
        document.getElementById('control-panel').classList.remove('result-mode');

        // 連打防止のロックも解除しておく
        this.isProcessing = false;

        this.switchScreen('game-screen');
        this.renderScene(stageData.startScene);
    },

    renderScene(sceneId) {
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

        if (scene.se) AudioSys.playSE(scene.se);

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
        } else if (scene.next) {
            const btn = document.createElement('div');
            btn.className = 'option-btn';
            btn.innerText = "次へ";
            btn.onclick = () => this.renderScene(scene.next);
            optsArea.appendChild(btn);
        }
    },

    resolveOption(opt) {
        if (this.isProcessing) return;
        this.isProcessing = true; // タイポ修正 (tru -> true)

        if(opt.hp) this.state.hp += opt.hp;
        if(opt.sanit) this.state.sanit += opt.sanit;
        if(opt.trust) this.state.trust += opt.trust;
        this.updateStatusUI();

        if (opt.fb) {
            this.state.history.push({ choice: opt.text, fb: opt.fb });
            
            // 3択（GOOD / WARNING / BAD）の判定
            let fbType = 'bad';
            let msg = "BAD CHOICE...";
            let se = 'bad';

            if (opt.fb.isWarning) {
                fbType = 'warning';
                msg = "CAUTION!";
                se = 'bad'; // 必要に応じて変更可能
            } else if (opt.fb.isGood) {
                fbType = 'good';
                msg = "GOOD CHOICE!";
                se = 'good';
            }

            AudioSys.playSE(se);
            this.showToast(msg, fbType); 
        }

        setTimeout(() => {
            this.renderScene(opt.next);
            this.isProcessing = false; // ロック解除
        }, 500); 
    },

    updateStatusUI() {
        document.getElementById('val-hp').innerText = this.state.hp;
        document.getElementById('gauge-hp').style.width = Math.max(0, Math.min(100, this.state.hp)) + '%';
        document.getElementById('val-sanit').innerText = this.state.sanit;
        document.getElementById('gauge-sanit').style.width = Math.max(0, Math.min(100, this.state.sanit)) + '%';
        document.getElementById('val-trust').innerText = this.state.trust;
        document.getElementById('gauge-trust').style.width = Math.max(0, Math.min(100, this.state.trust)) + '%';
    },

    // 3択対応に伴い引数を type に変更
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

        // フィードバックの生成
        this.state.history.forEach((h, i) => {
            
            // カードの色とバッジを3択で出し分ける
            let cardClass = 'bad';
            let badgeColor = '#d32f2f'; // 赤
            let badgeText = '危険';

            if (h.fb.isWarning) {
                cardClass = 'warning';
                badgeColor = '#f57c00'; // オレンジ（注意）
                badgeText = '注意';
            } else if (h.fb.isGood) {
                cardClass = 'good';
                badgeColor = '#2e7d32'; // 緑
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

            // isGoodではない（＝BADかWARNING）かつ ifWrongがある場合のみ表示
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

        // 参考文献リストの表示
        const refDiv = document.createElement('div');
        refDiv.className = 'fb-card';
        refDiv.style.borderLeft = "5px solid #546e7a"; 
        refDiv.innerHTML = `
            <div class="fb-header" style="color:#546e7a;">📚 参考資料・出典</div>
            <div class="fb-text" style="font-size:0.8rem; line-height:1.8;">
                <ul style="padding-left:20px; margin:0;">
                    <li>辻一郎. "被災者の生活支援、健康管理について". 東北大学大学院医学系研究科公衆衛生学.</li>
                    <li>内閣府. "避難所におけるトイレの確保・管理ガイドライン".</li>
                    <li>厚生労働省. "災害時における健康危機管理".</li>
                    <li>現地医師・薬剤師へのヒアリング調査 (2024)</li>
                    <li>https://www.cainz.com/kurashare/product-lists/2987</li>
                </ul>
            </div>
        `;
        list.appendChild(refDiv);
    }
};

// ゲーム初期化
Game.init();
