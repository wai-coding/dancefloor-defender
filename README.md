# Dancefloor Defender

A fast-paced retro arcade shooter built with vanilla JavaScript, HTML, and CSS.  
Defend the nightclub dancefloor from waves of bad DJs dropping USB drives — move, shoot vinyl records, and survive as long as you can!

![Dancefloor Defender Screenshot](images/screenshot.png)

---

## Controls

| Action          | Keyboard          | Touch (Mobile)         |
| --------------- | ----------------- | ---------------------- |
| Move left       | `←` Arrow         | Hold left third        |
| Move right      | `→` Arrow         | Hold right third       |
| Shoot           | `Space`           | Hold center third      |
| Pause / Resume  | `P`               | Menu button            |
| Mute / Unmute   | `M`               | Options menu           |
| Dark / Light    | `L`               | Options menu           |

- Touch movement is continuous while the finger is held down.
- You can move and shoot simultaneously with multiple fingers.

---

## How to Play on Mobile

The game screen is split into three vertical zones:

- **Left third** of the screen → move left
- **Right third** of the screen → move right
- **Center third** → shoot

Hold your finger down for continuous movement or rapid fire. You can use multiple fingers to move and shoot at the same time. Tap the **Menu** button (top-right corner) to pause the game and access options.

---

## Features

### Core Gameplay
- Smooth 60 FPS game loop with frame-based timing
- Progressive difficulty curve — spawn rate and enemy speed increase each level
- **Arcade impossible mode** kicks in at Level 5 (faster spawns, multi-enemy waves, fast enemies)
- Lives system: start with 3, max 5 — game over at 0
- Score and level displayed in a real-time HUD

### Enemies
- **Normal enemies** (USB drives) — 1 hit to destroy, +2 points per kill, +1 point if dodged
- **Angry enemies** (`enemy-angry.svg`) — appear from Level 5, 3 hits to destroy, zigzag movement, +2 points per hit, +5 points per kill

### Heart Power-Up
- Hearts spawn randomly between levels with a 20% chance
- **Pick up** a heart to gain +1 life (up to max 5) — silent, no sound effect
- **Shoot** a heart and you lose 1 life — be careful where you aim!

### High Scores
- **Top 10 leaderboard** on both Start screen and Game Over screen
- Always displays 10 rows (empty rows shown as placeholders)
- Enter your name inline when you qualify for the Top 10
- Save or Discard your score — Restart/Quit locked until you decide
- Persistent via `localStorage`

### In-Game Milestones
- **Top 10 message** — overlay appears when your score enters the Top 10 during gameplay
- **Top 1 record message** — special golden overlay when you beat the all-time #1 record
- High-score sound effect plays with music ducking for emphasis

### Audio
- Background music with looping and volume fade-in
- Sound effects: shoot, enemy hit, lose life, game over, next level, high score
- **Mute Music** and **Mute Sounds** — independent toggles in Start Options and Pause Options
- `M` key toggles both music and sounds at once
- Music fades down on Game Over, resumes on restart without restarting the track
- Mute preferences persisted in `localStorage`

### Theme
- **Dark / Light mode** toggle available in Start Options, Pause Options, and via `L` key
- Theme preference persisted in `localStorage` — applied on page load before UI is shown

### UI & Polish
- **Pause menu** (P key or Menu button) with Resume, Restart, Options, and Quit
- **Screen shake** on damage and enemy destruction
- **Enemy hit flash** — brief brightness burst before removal
- **Animated score count-up** with pop effect
- **Smooth screen transitions** (fade between Start, Game, and Game Over)
- **Level-up indicator** — centered overlay with fade animation
- **Heart-based lives display** — ♥ for remaining, ♡ for lost
- **Damage flash** — red radial overlay when losing a life
- **Quit option** from both Pause menu and Game Over screen

---

## Tech Stack

- **HTML5** — semantic markup, screen structure
- **CSS3** — animations (shake, flash, fade), transitions, responsive layout
- **JavaScript (ES6)** — OOP classes, DOM manipulation, `localStorage`, pointer events

No frameworks, no build tools, no external dependencies — pure vanilla JS, HTML, CSS.

---

## How to Run

1. Clone or download the repository
2. Open `index.html` in any modern browser
3. Click **Start Game** and defend the dancefloor!

> No server, build step, or dependencies required.

---

## Project Structure

```
index.html              → Entry point (all three screens)
styles/
  style.css             → All styling, animations, transitions
js/
  player.js             → Player class (movement, position)
  enemy.js              → Enemy class (spawn, movement, collision)
  bullet.js             → Bullet class (movement, hit detection)
  heart.js              → Heart power-up class (spawn, collision)
  game.js               → Game class (loop, scoring, difficulty, state)
  script.js             → UI logic, audio, input listeners, startup
assets/                 → Audio files (music, SFX)
images/                 → Sprites, backgrounds, logo, favicon, screenshot
```