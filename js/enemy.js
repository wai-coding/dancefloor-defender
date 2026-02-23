class Enemy {
  constructor(gameScreen, speedBoost = 0, type = "normal") {
    this.gameScreen = gameScreen;
    this.type = type;

    if (type === "fast") {
      this.width = 50;
      this.height = 50;
    } else {
      this.width = 70;
      this.height = 70;
    }

    this.left = Math.floor(Math.random() * (500 - this.width));
    this.top = -this.height;

    const baseSpeed = type === "fast" ? 3 + Math.random() * 2
                    : type === "angry" ? 1.8 + Math.random() * 1.2
                    : 2 + Math.random() * 2;
    this.speedY = baseSpeed + speedBoost;

    this.hp = type === "angry" ? 3 : 1;

    if (type === "angry") {
      this.vx = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5);
      this.zigzagTimer = 30 + Math.floor(Math.random() * 40);
    }

    this.element = document.createElement("img");
    this.element.src = type === "angry" ? "./images/enemy-angry.svg" : "./images/enemy.svg";
    this.element.classList.add("enemy");
    if (type === "fast") this.element.classList.add("enemy-fast");
    if (type === "angry") this.element.classList.add("enemy-angry");
    this.element.style.position = "absolute";
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.style.left = `${this.left}px`;
    this.element.style.top = `${this.top}px`;

    this.gameScreen.appendChild(this.element);
  }

  move() {
    this.top += this.speedY;

    if (this.type === "angry") {
      this.left += this.vx;
      this.zigzagTimer--;
      if (this.zigzagTimer <= 0) {
        this.vx = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5);
        this.zigzagTimer = 25 + Math.floor(Math.random() * 35);
      }
      if (this.left < 0) {
        this.left = 0;
        this.vx = Math.abs(this.vx);
      } else if (this.left + this.width > 500) {
        this.left = 500 - this.width;
        this.vx = -Math.abs(this.vx);
      }
    }

    this.updatePosition();
  }

  updatePosition() {
    this.element.style.left = `${this.left}px`;
    this.element.style.top = `${this.top}px`;
  }

  didCollide(player) {
    const enemyRect = this.element.getBoundingClientRect();
    const playerRect = player.element.getBoundingClientRect();

    const margin = this.type === "fast" ? 10 : 15;

    return (
      enemyRect.left + margin < playerRect.right - margin &&
      enemyRect.right - margin > playerRect.left + margin &&
      enemyRect.top + margin < playerRect.bottom - margin &&
      enemyRect.bottom - margin > playerRect.top + margin
    );
  }

  remove() {
    this.element.remove();
  }
}
