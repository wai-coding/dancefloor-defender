window.onload = function () {
  const MUSIC_VOLUME = 0.35;
  const SFX_VOLUME = 0.65;
  const MUSIC_GAMEOVER_VOLUME = 0.12;
  const MUSIC_MUTE_LS_KEY = "dancefloor_defender_music_muted";
  const SFX_MUTE_LS_KEY = "dancefloor_defender_sfx_muted";

  let ourGame = null;

  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const gameoverQuitButton = document.getElementById("gameover-quit-button");
  const gameScreenElement = document.getElementById("game-screen");

  const introGameArea = document.getElementById("intro-game-area");
  const endGameArea = document.getElementById("end-game-area");

  const pauseOverlay = document.getElementById("pause-overlay");
  const pauseMenuButton = document.getElementById("pause-menu-button");
  const resumeButton = document.getElementById("resume-button");
  const optionsButton = document.getElementById("options-button");
  const pauseMain = document.getElementById("pause-main");
  const pauseOptions = document.getElementById("pause-options");
  const pauseBackButton = document.getElementById("pause-back-button");
  const pauseOptionsResume = document.getElementById("pause-options-resume");
  const pauseTitle = document.querySelector("#pause-card h2");
  const pauseRestartButton = document.getElementById("pause-restart-button");
  const quitButton = document.getElementById("quit-button");

  const themeButton = document.getElementById("pause-theme-button");

  const pauseMuteMusicBtn = document.getElementById("pause-mute-music-button");
  const pauseMuteSoundsBtn = document.getElementById("pause-mute-sounds-button");

  const LIGHT_BG = "./images/background-light.png";
  const DARK_BG = "./images/background-dark.png";

  let isDarkMode = false;

  function applyTheme() {
    const bgUrl = isDarkMode ? `url("${DARK_BG}")` : `url("${LIGHT_BG}")`;

    if (introGameArea) introGameArea.style.backgroundImage = bgUrl;
    if (gameScreenElement) gameScreenElement.style.backgroundImage = bgUrl;
    if (endGameArea) endGameArea.style.backgroundImage = bgUrl;

    if (themeButton) {
      themeButton.textContent = isDarkMode
        ? "Turn On The Lights"
        : "Turn Off The Lights";
    }
  }

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      isDarkMode = !isDarkMode;
      applyTheme();
      // blur avoids space bar re-triggering
      themeButton.blur();
    });
  }

  applyTheme();

  const bgMusic = new Audio("./assets/music.mp3");
  bgMusic.loop = true;
  bgMusic.volume = 0;

  const shootSound = new Audio("./assets/shoot.wav");
  shootSound.volume = SFX_VOLUME;

  const enemyHitSound = new Audio("./assets/enemy-hit.wav");
  enemyHitSound.volume = SFX_VOLUME;

  // ── SFX manager: pre-loaded Audio objects, mute-aware ──
  const loseLifeSound = new Audio("./assets/lose-life.wav");
  loseLifeSound.volume = SFX_VOLUME;

  const gameOverSound = new Audio("./assets/game-over.wav");
  gameOverSound.volume = SFX_VOLUME;

  const nextLevelSound = new Audio("./assets/next-level.wav");
  nextLevelSound.volume = SFX_VOLUME;

  const highScoreSound = new Audio("./assets/high-score.wav");
  highScoreSound.volume = SFX_VOLUME;

  /** Play a named SFX once, respecting mute. Resets currentTime for rapid retrigger. */
  function playSfx(sound) {
    if (isSfxMuted) return;
    try {
      sound.currentTime = 0;
      sound.play();
    } catch (e) { /* browser autoplay guard */ }
  }

  let isMusicMuted = localStorage.getItem(MUSIC_MUTE_LS_KEY) === "true";
  let isSfxMuted = localStorage.getItem(SFX_MUTE_LS_KEY) === "true";

  function fadeAudio(audio, targetVolume, duration) {
    if (!audio) return;
    const startVolume = audio.volume;
    const diff = targetVolume - startVolume;
    if (Math.abs(diff) < 0.01) {
      audio.volume = targetVolume;
      return;
    }
    const steps = 20;
    const stepTime = duration / steps;
    let step = 0;

    const fadeInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      audio.volume = Math.max(0, Math.min(1, startVolume + diff * progress));
      if (step >= steps) {
        clearInterval(fadeInterval);
        audio.volume = targetVolume;
      }
    }, stepTime);
  }

  function playEnemyHitSound() {
    if (isSfxMuted) return;
    try {
      enemyHitSound.currentTime = 0;
      enemyHitSound.play();
    } catch (e) {}
  }

  // expose globally for game.js
  window.playEnemyHitSound = playEnemyHitSound;

  // ── Music ducking while important SFX plays ──
  const DUCK_VOLUME = 0.10;       // bgMusic volume while SFX is playing
  let activeDuckCount = 0;        // track overlapping ducks

  function duckMusicWhile(sound) {
    if (isMusicMuted) return;
    if (bgMusic.paused) return;

    activeDuckCount++;
    bgMusic.volume = DUCK_VOLUME;

    function restoreMusic() {
      activeDuckCount--;
      if (activeDuckCount <= 0) {
        activeDuckCount = 0;
        if (!isMusicMuted && !bgMusic.paused) {
          fadeAudio(bgMusic, MUSIC_VOLUME, 300);
        }
      }
    }

    sound.addEventListener("ended", restoreMusic, { once: true });
    // safety fallback: restore after sound duration + buffer
    const fallbackMs = (sound.duration && isFinite(sound.duration))
      ? (sound.duration * 1000 + 500) : 5000;
    setTimeout(function () {
      // only fire if ended didn't fire yet (count still > 0)
      if (activeDuckCount > 0) restoreMusic();
    }, fallbackMs);
  }

  // expose SFX for game.js (B, C, D, E)
  window.playLoseLifeSound  = function () { playSfx(loseLifeSound); };
  window.playGameOverSound  = function () {
    duckMusicWhile(gameOverSound);
    playSfx(gameOverSound);
  };
  window.playNextLevelSound = function () { playSfx(nextLevelSound); };
  window.playHighScoreSound = function () {
    duckMusicWhile(highScoreSound);
    playSfx(highScoreSound);
  };

  window.onGameOver = function () {
    if (!isMusicMuted) {
      fadeAudio(bgMusic, MUSIC_GAMEOVER_VOLUME, 400);
    }
  };

  function updatePauseMuteUI() {
    if (pauseMuteMusicBtn) pauseMuteMusicBtn.textContent = isMusicMuted ? "Unmute Music" : "Mute Music";
    if (pauseMuteSoundsBtn) pauseMuteSoundsBtn.textContent = isSfxMuted ? "Unmute Sounds" : "Mute Sounds";
  }

  if (pauseMuteMusicBtn) {
    pauseMuteMusicBtn.addEventListener("click", function () {
      isMusicMuted = !isMusicMuted;
      localStorage.setItem(MUSIC_MUTE_LS_KEY, isMusicMuted);

      if (isMusicMuted) {
        bgMusic.pause();
      } else {
        bgMusic.volume = 0;
        bgMusic.play().catch(() => {});
        fadeAudio(bgMusic, MUSIC_VOLUME, 300);
      }

      updatePauseMuteUI();
      updateStartMuteUI();
      this.blur();
    });
  }

  if (pauseMuteSoundsBtn) {
    pauseMuteSoundsBtn.addEventListener("click", function () {
      isSfxMuted = !isSfxMuted;
      localStorage.setItem(SFX_MUTE_LS_KEY, isSfxMuted);

      updatePauseMuteUI();
      updateStartMuteUI();
      this.blur();
    });
  }

  updatePauseMuteUI();

  // ── Start menu sub-panel navigation ──
  const startMainMenu = document.getElementById("start-main-menu");
  const startOptionsPanel = document.getElementById("start-options-panel");
  const startHighscoresPanel = document.getElementById("start-highscores-panel");
  const startInstructionsPanel = document.getElementById("start-instructions-panel");
  const startHighScoresList = document.getElementById("start-high-scores");

  const startOptionsBtn = document.getElementById("start-options-button");
  const startHighscoresBtn = document.getElementById("start-highscores-button");
  const startInstructionsBtn = document.getElementById("start-instructions-button");
  const startMuteMusicBtn = document.getElementById("start-mute-music-button");
  const startMuteSoundsBtn = document.getElementById("start-mute-sounds-button");
  const startThemeBtn = document.getElementById("start-theme-button");

  function showStartSubpanel(panel) {
    if (startMainMenu) startMainMenu.classList.add("hidden");
    if (panel) panel.classList.remove("hidden");
  }

  function showStartMainMenu() {
    if (startOptionsPanel) startOptionsPanel.classList.add("hidden");
    if (startHighscoresPanel) startHighscoresPanel.classList.add("hidden");
    if (startInstructionsPanel) startInstructionsPanel.classList.add("hidden");
    if (startMainMenu) startMainMenu.classList.remove("hidden");
  }

  function updateStartMuteUI() {
    if (startMuteMusicBtn) startMuteMusicBtn.textContent = isMusicMuted ? "Unmute Music" : "Mute Music";
    if (startMuteSoundsBtn) startMuteSoundsBtn.textContent = isSfxMuted ? "Unmute Sounds" : "Mute Sounds";
  }

  function updateStartThemeUI() {
    if (startThemeBtn) {
      startThemeBtn.textContent = isDarkMode ? "Turn On The Lights" : "Turn Off The Lights";
    }
  }

  function renderStartHighScores() {
    if (!startHighScoresList) return;
    const scores = JSON.parse(localStorage.getItem("high-scores")) || [];
    startHighScoresList.innerHTML = "";
    const top10 = scores.slice(0, 10);
    top10.forEach((entry, index) => {
      const li = document.createElement("li");
      li.className = "leaderboard-item";
      if (index < 3) li.classList.add("top-" + (index + 1));
      const rank = index + 1;
      const starHtml = rank <= 3 ? '<span class="rank-star">\u2605</span>' : "";
      const displayName = entry.name || "AAA";
      const scoreDisplay = String(entry.score).padStart(6, "0");
      const levelDisplay = "LVL " + String(entry.level).padStart(2, "0");
      // escapeHtml inline
      const div = document.createElement("div");
      div.textContent = displayName;
      const safeName = div.innerHTML;
      li.innerHTML =
        '<span class="rank"><span class="rank-num">' + rank + '.</span>' + starHtml + '</span>' +
        '<span class="leaderboard-name">' + safeName + '</span>' +
        '<span class="leaderboard-score">' + scoreDisplay + '</span>' +
        '<span class="leaderboard-level">' + levelDisplay + '</span>';
      startHighScoresList.appendChild(li);
    });
  }

  if (startOptionsBtn) {
    startOptionsBtn.addEventListener("click", function () {
      updateStartMuteUI();
      updateStartThemeUI();
      showStartSubpanel(startOptionsPanel);
      this.blur();
    });
  }

  if (startHighscoresBtn) {
    startHighscoresBtn.addEventListener("click", function () {
      renderStartHighScores();
      showStartSubpanel(startHighscoresPanel);
      this.blur();
    });
  }

  if (startInstructionsBtn) {
    startInstructionsBtn.addEventListener("click", function () {
      showStartSubpanel(startInstructionsPanel);
      this.blur();
    });
  }

  // Start Options panel — mute music button
  if (startMuteMusicBtn) {
    startMuteMusicBtn.addEventListener("click", function () {
      isMusicMuted = !isMusicMuted;
      localStorage.setItem(MUSIC_MUTE_LS_KEY, isMusicMuted);
      if (isMusicMuted) {
        bgMusic.pause();
      } else {
        bgMusic.volume = 0;
        bgMusic.play().catch(() => {});
        fadeAudio(bgMusic, MUSIC_VOLUME, 300);
      }
      updatePauseMuteUI();
      updateStartMuteUI();
      this.blur();
    });
  }

  // Start Options panel — mute sounds button
  if (startMuteSoundsBtn) {
    startMuteSoundsBtn.addEventListener("click", function () {
      isSfxMuted = !isSfxMuted;
      localStorage.setItem(SFX_MUTE_LS_KEY, isSfxMuted);
      updatePauseMuteUI();
      updateStartMuteUI();
      this.blur();
    });
  }

  // Start Options panel — theme button
  if (startThemeBtn) {
    startThemeBtn.addEventListener("click", function () {
      isDarkMode = !isDarkMode;
      applyTheme();
      updateStartThemeUI();
      this.blur();
    });
  }

  // Back buttons (all use data-back attribute)
  document.querySelectorAll(".start-back-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showStartMainMenu();
      this.blur();
    });
  });

  // prevent restarting music on game restart
  let musicStarted = false;

  function startMusicIfNeeded() {
    if (isMusicMuted) return;
    if (!musicStarted) {
      bgMusic.volume = 0;
      bgMusic.play().catch(() => {});
      fadeAudio(bgMusic, MUSIC_VOLUME, 400);
      musicStarted = true;
    } else {
      // already playing, just restore volume
      if (bgMusic.paused) {
        bgMusic.play().catch(() => {});
      }
      fadeAudio(bgMusic, MUSIC_VOLUME, 300);
    }
  }

  startButton.addEventListener("click", function () {
    ourGame = new Game();
    ourGame.start();

    // user gesture needed for audio
    startMusicIfNeeded();
  });

  restartButton.addEventListener("click", function () {
    if (!ourGame) return;
    ourGame.restart();

    // restore volume, don't restart track
    startMusicIfNeeded();
  });

  if (gameoverQuitButton) {
    gameoverQuitButton.addEventListener("click", function () {
      if (!ourGame) return;
      ourGame.quitToStart();
      showStartMainMenu();
      this.blur();
    });
  }

  function showPauseOverlay() {
    if (pauseOverlay) pauseOverlay.classList.add("visible");
  }

  function hidePauseOverlay() {
    if (pauseOverlay) pauseOverlay.classList.remove("visible");
    // Reset to main menu view
    if (pauseMain) pauseMain.classList.remove("pause-section-hidden");
    if (pauseOptions) pauseOptions.classList.add("pause-section-hidden");
    if (pauseTitle) pauseTitle.textContent = "PAUSED";
  }

  function doPauseToggle() {
    if (!ourGame || ourGame.gameIsOver || !ourGame.player) return;
    ourGame.togglePause();
    if (ourGame.isPaused) {
      showPauseOverlay();
    } else {
      hidePauseOverlay();
    }
  }

  if (pauseMenuButton) {
    pauseMenuButton.addEventListener("click", function () {
      doPauseToggle();
      this.blur();
    });
  }

  if (resumeButton) {
    resumeButton.addEventListener("click", function () {
      if (ourGame && ourGame.isPaused) {
        doPauseToggle();
      }
      this.blur();
    });
  }

  if (optionsButton) {
    optionsButton.addEventListener("click", function () {
      if (pauseMain) pauseMain.classList.add("pause-section-hidden");
      if (pauseOptions) pauseOptions.classList.remove("pause-section-hidden");
      if (pauseTitle) pauseTitle.textContent = "OPTIONS";
      updatePauseMuteUI();
      this.blur();
    });
  }

  if (pauseBackButton) {
    pauseBackButton.addEventListener("click", function () {
      if (pauseOptions) pauseOptions.classList.add("pause-section-hidden");
      if (pauseMain) pauseMain.classList.remove("pause-section-hidden");
      if (pauseTitle) pauseTitle.textContent = "PAUSED";
      this.blur();
    });
  }

  if (pauseOptionsResume) {
    pauseOptionsResume.addEventListener("click", function () {
      if (ourGame && ourGame.isPaused) {
        doPauseToggle();
      }
      this.blur();
    });
  }

  if (pauseRestartButton) {
    pauseRestartButton.addEventListener("click", function () {
      if (!ourGame) return;
      ourGame.isPaused = false;
      hidePauseOverlay();
      ourGame.restart();
      startMusicIfNeeded();
      this.blur();
    });
  }

  if (quitButton) {
    quitButton.addEventListener("click", function () {
      if (!ourGame) return;
      hidePauseOverlay();
      ourGame.quitToStart();
      showStartMainMenu();
      this.blur();
    });
  }

  window.addEventListener("keydown", function (event) {
    // ── Skip global hotkeys when typing in an input ──
    const tag = document.activeElement && document.activeElement.tagName;
    const isTyping = tag === "INPUT" || tag === "TEXTAREA";

    // ── Global hotkeys (work on ALL screens, except when typing) ──
    if (!isTyping && event.code === "KeyM") {
      var allMuted = isMusicMuted && isSfxMuted;
      isMusicMuted = !allMuted;
      isSfxMuted = !allMuted;
      localStorage.setItem(MUSIC_MUTE_LS_KEY, isMusicMuted);
      localStorage.setItem(SFX_MUTE_LS_KEY, isSfxMuted);

      if (isMusicMuted) {
        bgMusic.pause();
      } else {
        bgMusic.volume = 0;
        bgMusic.play().catch(() => {});
        fadeAudio(bgMusic, MUSIC_VOLUME, 300);
      }

      updatePauseMuteUI();
      updateStartMuteUI();
      return;
    }

    if (!isTyping && event.code === "KeyL") {
      isDarkMode = !isDarkMode;
      applyTheme();
      updateStartThemeUI();
      return;
    }

    // ── Game-specific controls below ──
    if (!ourGame || !ourGame.player) return;

    if (event.code === "KeyP") {
      doPauseToggle();
      return;
    }

    // block input while paused
    if (ourGame.isPaused || ourGame.gameIsOver) return;

    if (event.code === "ArrowLeft") {
      ourGame.player.speedX = -5;
    }

    if (event.code === "ArrowRight") {
      ourGame.player.speedX = 5;
    }

    if (event.code === "Space") {
      const bulletLeft = ourGame.player.left + ourGame.player.width / 2 - 3;
      const bulletTop = ourGame.player.top - 10;

      const newBullet = new Bullet(ourGame.gameScreen, bulletLeft, bulletTop);
      ourGame.bullets.push(newBullet);

      if (!isSfxMuted) {
        try {
          // reset to allow rapid fire
          shootSound.currentTime = 0;
          shootSound.play();
        } catch (e) {
          // browser may block autoplay
        }
      }
    }
  });

  window.addEventListener("keyup", function (event) {
    if (!ourGame || !ourGame.player) return;

    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      ourGame.player.speedX = 0;
    }
  });

  // touch controls
  if (gameScreenElement) {
    gameScreenElement.addEventListener("touchstart", function (event) {
      if (!ourGame || !ourGame.player) return;
      if (ourGame.isPaused || ourGame.gameIsOver) return;

      const touch = event.touches[0];
      const rect = gameScreenElement.getBoundingClientRect();

      const relativeX = touch.clientX - rect.left;
      const third = rect.width / 3;

      if (relativeX < third) {
        ourGame.player.speedX = -5;
      } else if (relativeX > 2 * third) {
        ourGame.player.speedX = 5;
      } else {
        const bulletLeft = ourGame.player.left + ourGame.player.width / 2 - 3;
        const bulletTop = ourGame.player.top - 10;

        const newBullet = new Bullet(ourGame.gameScreen, bulletLeft, bulletTop);
        ourGame.bullets.push(newBullet);

        if (!isSfxMuted) {
          try {
            shootSound.currentTime = 0;
            shootSound.play();
          } catch (e) {}
        }
      }
    });

    gameScreenElement.addEventListener("touchend", function (event) {
      if (!ourGame || !ourGame.player) return;
      ourGame.player.speedX = 0;
    });
  }
};
