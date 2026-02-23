const DIFFICULTY_CONFIG = {
  baseSpawnInterval: 90,      // frames between spawns at level 1
  minSpawnInterval: 40,       // fastest allowed spawn rate
  spawnReductionPerLevel: 5,  // frames subtracted per difficulty tick
  difficultyTickFrames: 600,  // frames between difficulty increases (~10 s)
  maxDifficulty: 15,          // cap difficulty so it doesn't go infinite
  speedBoostPerLevel: 0.3,    // enemy speed increase per difficulty tick
  maxSpeedBoost: 4.5,         // cap speed boost (prevents unreactable speeds)
};

class Game {
  constructor() {
    this.startScreen = document.getElementById("game-intro");
    this.gameContainer = document.getElementById("game-container");
    this.gameScreen = document.getElementById("game-screen");
    this.endScreen = document.getElementById("game-end");

    this.score = 0;
    this.displayedScore = 0;
    this.scoreAnimationId = null; // avoid stacking RAF
    this.scoreElement = document.getElementById("score");
    this.finalScoreElement = document.getElementById("final-score");

    this.bestScoreElement = document.getElementById("best-score");
    this.bestScoreEndElement = document.getElementById("best-score-end");

    this.highScoreContainer = document.getElementById("high-scores");

    this.level = 1;
    this.levelElement = document.getElementById("level");

    this.lives = 3;
    this.livesElement = document.getElementById("lives");
    this.levelIndicator = document.getElementById("level-indicator");
    this.damageOverlay = document.getElementById("damage-overlay");
    this.highscoreIndicator = document.getElementById("highscore-indicator");
    this.maxLives = 3;

    this.player = null;
    this.enemies = [];
    this.bullets = [];

    this.gameIsOver = false;
    this.frames = 0;
    this.difficulty = 0;

    this.gameInterval = null;
    this.isPaused = false;

    // Overlay queue system
    this.overlayQueue = [];
    this.isOverlayActive = false;

    // Per-run highscore milestone flags
    this.top10Triggered = false;
    this.top1Triggered = false;

    this.width = 500;
    this.height = 600;

    this.updateBestScoreDisplay();
  }

  showScreen(screen, displayMode) {
    screen.style.display = displayMode || "flex";
    requestAnimationFrame(() => {
      screen.classList.remove("is-hidden");
    });
  }

  hideScreen(screen, cb) {
    screen.classList.add("is-hidden");
    setTimeout(() => {
      screen.style.display = "none";
      if (cb) cb();
    }, 220);
  }

  triggerShake() {
    this.gameScreen.classList.remove("shake");
    void this.gameScreen.offsetWidth; // force reflow to re-trigger animation
    this.gameScreen.classList.add("shake");
    this.gameScreen.addEventListener(
      "animationend",
      () => this.gameScreen.classList.remove("shake"),
      { once: true }
    );
  }

  showLevelUp(level) {
    if (!this.levelIndicator) return;
    this.queueOverlay(
      () => {
        this.levelIndicator.textContent = `Level ${level}`;
        this.levelIndicator.classList.add("show");
        if (window.playNextLevelSound) window.playNextLevelSound();
      },
      () => {
        this.levelIndicator.classList.remove("show");
      },
      1500
    );
  }

  // ── Overlay queue system ──

  queueOverlay(showFn, hideFn, duration) {
    if (this.isOverlayActive) {
      this.overlayQueue.push({ showFn, hideFn, duration });
    } else {
      this.runOverlay(showFn, hideFn, duration);
    }
  }

  runOverlay(showFn, hideFn, duration) {
    this.isOverlayActive = true;
    showFn();
    clearTimeout(this._overlayTimeout);
    this._overlayTimeout = setTimeout(() => {
      hideFn();
      this.isOverlayActive = false;
      if (this.overlayQueue.length > 0) {
        const next = this.overlayQueue.shift();
        this.runOverlay(next.showFn, next.hideFn, next.duration);
      }
    }, duration);
  }

  // ── Top milestone overlay during gameplay ──

  queueTopMilestone(type) {
    if (!this.highscoreIndicator) return;
    let text, duration;
    if (type === "top1") {
      text = "You just beat the game record!";
      duration = 2600;
    } else {
      text = "You just made the Top 10!";
      duration = 1800;
    }
    this.queueOverlay(
      () => {
        this.highscoreIndicator.textContent = text;
        this.highscoreIndicator.classList.remove("top1");
        if (type === "top1") this.highscoreIndicator.classList.add("top1");
        this.highscoreIndicator.classList.add("show");
        if (window.playHighScoreSound) window.playHighScoreSound();
      },
      () => {
        this.highscoreIndicator.classList.remove("show");
        const removeTop1AfterTransition = () => {
          this.highscoreIndicator.classList.remove("top1");
          this.highscoreIndicator.removeEventListener("transitionend", removeTop1AfterTransition);
        };
        this.highscoreIndicator.addEventListener("transitionend", removeTop1AfterTransition);
      },
      duration
    );
  }

  checkHighScoreMilestonesDuringRun() {
    const scores = JSON.parse(localStorage.getItem("high-scores")) || [];
    scores.sort((a, b) => b.score - a.score);

    const has10Entries = scores.length >= 10;
    const top1Score = scores.length > 0 ? scores[0].score : 0;
    const top10Score = has10Entries ? scores[9].score : null;

    if (!this.top1Triggered && this.score > top1Score) {
      this.queueTopMilestone("top1");
      this.top1Triggered = true;
      this.top10Triggered = true; // suppress top10 if top1 fires
    } else if (has10Entries && !this.top10Triggered && this.score > top10Score) {
      this.queueTopMilestone("top10");
      this.top10Triggered = true;
    }
  }

  updateLivesDisplay() {
    if (!this.livesElement) return;
    let hearts = "";
    for (let i = 0; i < this.maxLives; i++) {
      if (i < this.lives) {
        hearts += '<span class="heart full">\u2665</span>';
      } else {
        hearts += '<span class="heart empty">\u2661</span>';
      }
    }
    this.livesElement.innerHTML = hearts;
  }

  triggerDamageFlash() {
    if (!this.damageOverlay) return;
    this.damageOverlay.classList.add("flash");
    setTimeout(() => {
      this.damageOverlay.classList.remove("flash");
    }, 150);
  }

  setScore(nextScore) {
    this.score = nextScore;
    this.checkHighScoreMilestonesDuringRun();

    // cancel previous to avoid stacking
    if (this.scoreAnimationId) {
      cancelAnimationFrame(this.scoreAnimationId);
    }

    const startVal = this.displayedScore;
    const diff = nextScore - startVal;
    const duration = 150; // ms
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      this.displayedScore = Math.round(startVal + diff * progress);
      this.scoreElement.innerText = this.displayedScore;

      if (progress < 1) {
        this.scoreAnimationId = requestAnimationFrame(animate);
      } else {
        this.scoreAnimationId = null;
        // pop feedback
        this.scoreElement.classList.remove("score-pop");
        void this.scoreElement.offsetWidth;
        this.scoreElement.classList.add("score-pop");
      }
    };

    this.scoreAnimationId = requestAnimationFrame(animate);
  }

  getBestScoreFromLS() {
    const scores = JSON.parse(localStorage.getItem("high-scores"));
    if (!scores || scores.length === 0) return 0;
    return scores[0].score; // already sorted descending
  }

  updateBestScoreDisplay() {
    const best = this.getBestScoreFromLS();
    if (this.bestScoreElement) this.bestScoreElement.innerText = best;
    if (this.bestScoreEndElement) this.bestScoreEndElement.innerText = best;
  }

  // shared cleanup for restart and gameOver
  clearGameEntities() {
    if (this.player && this.player.element && this.player.element.parentNode) {
      this.player.element.remove();
    }
    this.player = null;

    this.enemies.forEach((e) => {
      if (e.element && e.element.parentNode) e.element.remove();
    });
    this.enemies = [];

    this.bullets.forEach((b) => {
      if (b.element && b.element.parentNode) b.element.remove();
    });
    this.bullets = [];
  }

  start() {
    this.hideScreen(this.startScreen);
    this.hideScreen(this.endScreen);

    // wait for hide transition
    setTimeout(() => {
      this.gameScreen.style.display = "";
      this.showScreen(this.gameContainer, "flex");

      this.gameScreen.style.width = `${this.width}px`;
      this.gameScreen.style.height = `${this.height}px`;

      this.clearGameEntities();

      this.player = new Player(this.gameScreen);

      this.enemies = [];
      this.bullets = [];
      this.frames = 0;
      this.gameIsOver = false;
      this.isPaused = false;

      this.difficulty = 0;
      this.level = 1;
      this.levelElement.innerText = this.level;

      this.score = 0;
      this.displayedScore = 0;
      this.scoreElement.innerText = 0;

      this.lives = 3;
      this.updateLivesDisplay();

      if (this.levelIndicator) this.levelIndicator.classList.remove("show");
      if (this.damageOverlay) this.damageOverlay.classList.remove("flash");
      if (this.highscoreIndicator) this.highscoreIndicator.classList.remove("show", "top1");
      clearTimeout(this._hsTimeout);
      clearTimeout(this._overlayTimeout);
      this.overlayQueue = [];
      this.isOverlayActive = false;
      this.top10Triggered = false;
      this.top1Triggered = false;

      this.updateBestScoreDisplay();

      // avoid interval stacking
      if (this.gameInterval) {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
      }

      this.gameInterval = setInterval(() => {
        this.gameLoop();
      }, 1000 / 60);
    }, 240);
  }

  restart() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }

    // prevent orphan animation
    if (this.scoreAnimationId) {
      cancelAnimationFrame(this.scoreAnimationId);
      this.scoreAnimationId = null;
    }

    this.clearGameEntities();
    this.hideScreen(this.endScreen);

    setTimeout(() => {
      this.gameScreen.style.display = "";
      this.showScreen(this.gameContainer, "flex");

      this.player = new Player(this.gameScreen);

      this.enemies = [];
      this.bullets = [];
      this.frames = 0;
      this.gameIsOver = false;
      this.isPaused = false;

      this.difficulty = 0;
      this.level = 1;
      this.levelElement.innerText = this.level;

      this.score = 0;
      this.displayedScore = 0;
      this.scoreElement.innerText = 0;

      this.lives = 3;
      this.updateLivesDisplay();

      if (this.levelIndicator) this.levelIndicator.classList.remove("show");
      if (this.damageOverlay) this.damageOverlay.classList.remove("flash");
      if (this.highscoreIndicator) this.highscoreIndicator.classList.remove("show", "top1");
      clearTimeout(this._hsTimeout);
      clearTimeout(this._overlayTimeout);
      this.overlayQueue = [];
      this.isOverlayActive = false;
      this.top10Triggered = false;
      this.top1Triggered = false;

      this.updateBestScoreDisplay();

      this.gameInterval = setInterval(() => {
        this.gameLoop();
      }, 1000 / 60);
    }, 240);
  }

  quitToStart() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }

    if (this.scoreAnimationId) {
      cancelAnimationFrame(this.scoreAnimationId);
      this.scoreAnimationId = null;
    }

    this.isPaused = false;
    this.gameIsOver = false;

    this.clearGameEntities();

    this.enemies = [];
    this.bullets = [];
    this.frames = 0;
    this.difficulty = 0;
    this.level = 1;
    this.score = 0;
    this.displayedScore = 0;

    this.scoreElement.innerText = 0;
    this.levelElement.innerText = 1;
    this.lives = 3;
    this.updateLivesDisplay();

    if (this.levelIndicator) this.levelIndicator.classList.remove("show");
    if (this.damageOverlay) this.damageOverlay.classList.remove("flash");
    if (this.highscoreIndicator) this.highscoreIndicator.classList.remove("show", "top1");
    clearTimeout(this._levelTimeout);
    clearTimeout(this._hsTimeout);
    clearTimeout(this._overlayTimeout);
    this.overlayQueue = [];
    this.isOverlayActive = false;
    this.top10Triggered = false;
    this.top1Triggered = false;

    this.hideScreen(this.gameContainer);
    this.hideScreen(this.endScreen);
    setTimeout(() => {
      this.showScreen(this.startScreen, "flex");
    }, 240);
  }

  pause() {
    if (this.gameIsOver || this.isPaused) return;
    this.isPaused = true;
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
  }

  resume() {
    if (this.gameIsOver || !this.isPaused) return;
    this.isPaused = false;
    // prevent ghost movement from held keys
    if (this.player) this.player.speedX = 0;
    if (!this.gameInterval) {
      this.gameInterval = setInterval(() => {
        this.gameLoop();
      }, 1000 / 60);
    }
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  gameLoop() {
    if (this.gameIsOver) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
      this.gameOver();
      return;
    }

    this.frames++;

    // bump difficulty every ~10s, capped
    if (
      this.frames % DIFFICULTY_CONFIG.difficultyTickFrames === 0 &&
      this.difficulty < DIFFICULTY_CONFIG.maxDifficulty
    ) {
      this.difficulty++;

      this.level = this.difficulty + 1;
      this.levelElement.innerText = this.level;
      this.showLevelUp(this.level);
    }

    const spawnInterval = Math.max(
      DIFFICULTY_CONFIG.minSpawnInterval,
      DIFFICULTY_CONFIG.baseSpawnInterval -
        this.difficulty * DIFFICULTY_CONFIG.spawnReductionPerLevel
    );

    if (this.frames % spawnInterval === 0) {
      const speedBoost = Math.min(
        this.difficulty * DIFFICULTY_CONFIG.speedBoostPerLevel,
        DIFFICULTY_CONFIG.maxSpeedBoost
      );
      const newEnemy = new Enemy(this.gameScreen, speedBoost);
      this.enemies.push(newEnemy);
    }

    if (window.processInput) window.processInput();
    this.update();
  }

  update() {
    this.player.move();

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      enemy.move();

      if (enemy.didCollide(this.player)) {
        enemy.remove();
        this.enemies.splice(i, 1);
        i--;

        this.triggerShake();

        this.lives--;
        this.updateLivesDisplay();
        this.triggerDamageFlash();

        if (this.lives <= 0) {
          this.gameIsOver = true;
          // game-over SFX plays in gameOver(); skip lose-life
        } else {
          // B) lose-life SFX (non-fatal hit only)
          if (window.playLoseLifeSound) window.playLoseLifeSound();
        }

        continue;
      }

      // dodged enemy = +1 point
      if (enemy.top > this.height) {
        enemy.remove();
        this.enemies.splice(i, 1);
        i--;

        this.setScore(this.score + 1);
      }
    }

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.move();

      if (bullet.top < -20) {
        bullet.remove();
        this.bullets.splice(i, 1);
        i--;
      }
    }

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];

      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j];

        if (bullet.didHit(enemy)) {
          if (window.playEnemyHitSound) {
            window.playEnemyHitSound();
          }

          this.triggerShake();

          bullet.remove();
          this.bullets.splice(i, 1);

          this.enemies.splice(j, 1);

          // flash then remove
          enemy.element.classList.add("enemy-hit");
          setTimeout(() => {
            enemy.remove();
          }, 70);

          this.setScore(this.score + 2);

          i--;
          break;
        }
      }
    }
  }

  gameOver() {
    // Clear pending overlay queue (let active highscore overlay finish naturally)
    this.overlayQueue = [];
    if (this.levelIndicator) this.levelIndicator.classList.remove("show");

    // C) game-over SFX (once, on final life loss)
    if (window.playGameOverSound) window.playGameOverSound();

    // notify audio to fade music
    if (window.onGameOver) {
      window.onGameOver();
    }

    this.hideScreen(this.gameContainer);
    setTimeout(() => {
      this.showScreen(this.endScreen, "flex");
    }, 240);

    this.finalScoreElement.innerText = this.score;

    const highScoresFromLS = JSON.parse(localStorage.getItem("high-scores")) || [];

    // Check if current score qualifies for Top 10
    const qualifiesForTop10 = this.checkQualifiesForTop10(highScoresFromLS, this.score);

    // Compute rank for E) Top10 / Top1 overlay
    let rank = 0;
    if (qualifiesForTop10) {
      const allForRank = [...highScoresFromLS, { score: this.score, isPending: true }];
      allForRank.sort((a, b) => b.score - a.score);
      const top10ForRank = allForRank.slice(0, 10);
      rank = top10ForRank.findIndex(e => e.isPending) + 1;
    }

    // E) High-score overlay + SFX — skip if already shown during gameplay
    if (!this.top1Triggered && !this.top10Triggered) {
      const hsIndicator = document.getElementById("highscore-indicator");
      if (hsIndicator) {
        hsIndicator.classList.remove("show", "top1");
        clearTimeout(this._hsTimeout);

        if (qualifiesForTop10 && rank > 0) {
          if (rank === 1) {
            hsIndicator.textContent = "NEW #1 HIGH SCORE!";
            hsIndicator.classList.add("top1");
          } else {
            hsIndicator.textContent = "TOP 10!  #" + rank;
          }

          // Play high-score SFX once (covers both top1 and top10)
          if (window.playHighScoreSound) window.playHighScoreSound();

          // Show after end screen appears
          setTimeout(() => {
            hsIndicator.classList.add("show");
          }, 300);

          const duration = rank === 1 ? 2500 : 1800;
          this._hsTimeout = setTimeout(() => {
            hsIndicator.classList.remove("show");
          }, 300 + duration);
        }
      }
    }

    // Set dynamic game over message
    const top10Message = document.getElementById("top10-message");
    if (top10Message) {
      if (qualifiesForTop10) {
        top10Message.textContent = "Congratulations! You placed #" + rank + "!";
        top10Message.classList.remove("hidden", "miss");
      } else {
        top10Message.textContent = "Good run! Try again and climb the leaderboard.";
        top10Message.classList.remove("hidden");
        top10Message.classList.add("miss");
      }
    }

    // Get UI elements - hide the old name entry section (now using inline)
    const nameEntrySection = document.getElementById("name-entry-section");
    nameEntrySection.classList.add("hidden");

    const restartBtn = document.getElementById("restart-button");
    const quitBtn = document.getElementById("gameover-quit-button");

    // Get Save/Discard buttons
    const saveBtn = document.getElementById("save-button");
    const discardBtn = document.getElementById("discard-button");

    if (qualifiesForTop10) {
      // Disable Restart/Quit until save or discard
      restartBtn.disabled = true;
      quitBtn.disabled = true;

      // Store current score/level for saving later
      this._pendingScore = this.score;
      this._pendingLevel = this.level;
      this._pendingEntry = {
        name: "",
        score: this.score,
        level: this.level,
        isPending: true,
      };

      // Show Save/Discard buttons
      saveBtn.classList.remove("hidden");
      discardBtn.classList.remove("hidden");

      // Render leaderboard with pending inline entry (input only, no inline save)
      this.renderLeaderboardWithPending(highScoresFromLS, this._pendingEntry);

      // Set up Save/Discard handlers
      this.setupSaveDiscardHandlers(restartBtn, quitBtn, saveBtn, discardBtn);

    } else {
      // Does not qualify - enable buttons, show leaderboard normally
      restartBtn.disabled = false;
      quitBtn.disabled = false;

      // Hide Save/Discard buttons
      saveBtn.classList.add("hidden");
      discardBtn.classList.add("hidden");

      // Render existing leaderboard
      this.renderLeaderboard(highScoresFromLS);
    }

    this.updateBestScoreDisplay();
  }

  renderLeaderboardWithPending(existingScores, pendingEntry) {
    // Merge pending entry with existing scores
    const allScores = [...existingScores, pendingEntry];
    allScores.sort((a, b) => b.score - a.score);
    const top10 = allScores.slice(0, 10);

    this.highScoreContainer.innerHTML = "";

    for (let i = 0; i < 10; i++) {
      const li = document.createElement("li");
      li.className = "leaderboard-item";
      const rank = i + 1;
      const starHtml = rank <= 3 ? `<span class="rank-star">★</span>` : "";

      if (top10[i]) {
        if (i < 3) li.classList.add(`top-${i + 1}`);
        const scoreDisplay = String(top10[i].score).padStart(6, "0");
        const levelDisplay = "LVL " + String(top10[i].level).padStart(2, "0");

        if (top10[i].isPending) {
          li.classList.add("pending-row");
          li.innerHTML = `
            <span class="rank"><span class="rank-num">${rank}.</span>${starHtml}</span>
            <input type="text" id="pending-name-input" class="pending-name-input" maxlength="10" placeholder="Name" autocomplete="off" />
            <span class="leaderboard-score">${scoreDisplay}</span>
            <span class="leaderboard-level">${levelDisplay}</span>
          `;
        } else {
          const displayName = top10[i].name || "AAA";
          li.innerHTML = `
            <span class="rank"><span class="rank-num">${rank}.</span>${starHtml}</span>
            <span class="leaderboard-name">${this.escapeHtml(displayName)}</span>
            <span class="leaderboard-score">${scoreDisplay}</span>
            <span class="leaderboard-level">${levelDisplay}</span>
          `;
        }
      } else {
        li.classList.add("empty-row");
        li.innerHTML = `
          <span class="rank"><span class="rank-num">${rank}.</span>${starHtml}</span>
          <span class="leaderboard-name"></span>
          <span class="leaderboard-score"></span>
          <span class="leaderboard-level"></span>
        `;
      }

      this.highScoreContainer.appendChild(li);
    }

    // Focus the input after render
    setTimeout(() => {
      const input = document.getElementById("pending-name-input");
      if (input) input.focus();
    }, 50);
  }

  setupSaveDiscardHandlers(restartBtn, quitBtn, saveBtn, discardBtn) {
    // Remove previous listeners if any
    if (this._saveHandler) {
      saveBtn.removeEventListener("click", this._saveHandler);
    }
    if (this._discardHandler) {
      discardBtn.removeEventListener("click", this._discardHandler);
    }
    if (this._enterKeyHandler) {
      document.removeEventListener("keydown", this._enterKeyHandler);
    }

    const finishFlow = () => {
      // Re-enable Restart/Quit buttons
      restartBtn.disabled = false;
      quitBtn.disabled = false;

      // Hide Save/Discard buttons
      saveBtn.classList.add("hidden");
      discardBtn.classList.add("hidden");

      // Clean up pending state
      this._pendingEntry = null;

      // Clean up event listeners
      if (this._saveHandler) {
        saveBtn.removeEventListener("click", this._saveHandler);
        this._saveHandler = null;
      }
      if (this._discardHandler) {
        discardBtn.removeEventListener("click", this._discardHandler);
        this._discardHandler = null;
      }
      if (this._enterKeyHandler) {
        document.removeEventListener("keydown", this._enterKeyHandler);
        this._enterKeyHandler = null;
      }
    };

    const handleSave = () => {
      const input = document.getElementById("pending-name-input");
      if (!input) return;

      const raw = input.value.trim();
      const name = raw.length > 0 ? (this.validateAndNormalizeName(input.value) || "AAA") : "AAA";

      // Save to localStorage
      this.saveScoreWithName(name, this._pendingScore, this._pendingLevel);

      finishFlow();
    };

    const handleDiscard = () => {
      // Do NOT save - just re-render existing leaderboard
      const highScoresFromLS = JSON.parse(localStorage.getItem("high-scores")) || [];
      this.renderLeaderboard(highScoresFromLS);

      finishFlow();
    };

    this._saveHandler = (e) => {
      e.preventDefault();
      handleSave();
    };

    this._discardHandler = (e) => {
      e.preventDefault();
      handleDiscard();
    };

    this._enterKeyHandler = (e) => {
      const input = document.getElementById("pending-name-input");
      if (input && document.activeElement === input && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };

    saveBtn.addEventListener("click", this._saveHandler);
    discardBtn.addEventListener("click", this._discardHandler);
    document.addEventListener("keydown", this._enterKeyHandler);
  }

  checkQualifiesForTop10(scores, currentScore) {
    if (scores.length < 10) return true;
    // scores should be sorted, but sort again for safety
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return currentScore > sorted[9].score;
  }

  validateAndNormalizeName(rawName) {
    // Trim and normalize multiple spaces to single space
    let name = rawName.trim().replace(/\s+/g, " ");
    // Enforce length 1-10
    if (name.length < 1 || name.length > 10) return null;
    return name;
  }

  saveScoreWithName(name, score, level) {
    const highScoresFromLS = JSON.parse(localStorage.getItem("high-scores")) || [];

    const newEntry = {
      name: name,
      score: score,
      level: level,
    };

    highScoresFromLS.push(newEntry);
    highScoresFromLS.sort((a, b) => b.score - a.score);
    const updatedScores = highScoresFromLS.slice(0, 10);

    localStorage.setItem("high-scores", JSON.stringify(updatedScores));
    this.updateBestScoreDisplay();
    this.renderLeaderboard(updatedScores);
  }

  renderLeaderboard(scores) {
    this.highScoreContainer.innerHTML = "";
    const top10 = scores.slice(0, 10);

    for (let i = 0; i < 10; i++) {
      const li = document.createElement("li");
      li.className = "leaderboard-item";
      const rank = i + 1;
      const starHtml = rank <= 3 ? `<span class="rank-star">★</span>` : "";

      if (top10[i]) {
        if (i < 3) li.classList.add(`top-${i + 1}`);
        const displayName = top10[i].name || "AAA";
        const scoreDisplay = String(top10[i].score).padStart(6, "0");
        const levelDisplay = "LVL " + String(top10[i].level).padStart(2, "0");

        li.innerHTML = `
          <span class="rank"><span class="rank-num">${rank}.</span>${starHtml}</span>
          <span class="leaderboard-name">${this.escapeHtml(displayName)}</span>
          <span class="leaderboard-score">${scoreDisplay}</span>
          <span class="leaderboard-level">${levelDisplay}</span>
        `;
      } else {
        li.classList.add("empty-row");
        li.innerHTML = `
          <span class="rank"><span class="rank-num">${rank}.</span>${starHtml}</span>
          <span class="leaderboard-name"></span>
          <span class="leaderboard-score"></span>
          <span class="leaderboard-level"></span>
        `;
      }

      this.highScoreContainer.appendChild(li);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
