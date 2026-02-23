class Heart {
  constructor(gameScreen, playerLeft, playerWidth) {
    this.gameScreen = gameScreen;

    this.width = 36;
    this.height = 36;

    this.left = this.pickSafeX(playerLeft, playerWidth);
    this.top = -this.height;

    this.speedY = 1.8 + Math.random() * 0.6;

    this.element = document.createElement("img");
    this.element.src = "./images/heart.svg";
    this.element.classList.add("heart-powerup");
    this.element.style.position = "absolute";
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.style.left = `${this.left}px`;
    this.element.style.top = `${this.top}px`;

    this.gameScreen.appendChild(this.element);
  }

  pickSafeX(playerLeft, playerWidth) {
    const minSafeDist = 80;
    const playerCenter = playerLeft + playerWidth / 2;
    let x;
    let tries = 0;

    do {
      x = Math.floor(Math.random() * (500 - this.width));
      tries++;
    } while (
      tries < 5 &&
      Math.abs(x + this.width / 2 - playerCenter) < minSafeDist
    );

    return x;
  }

  move() {
    this.top += this.speedY;
    this.updatePosition();
  }

  updatePosition() {
    this.element.style.left = `${this.left}px`;
    this.element.style.top = `${this.top}px`;
  }

  didCollidePlayer(player) {
    const heartRect = this.element.getBoundingClientRect();
    const playerRect = player.element.getBoundingClientRect();

    const margin = 8;
    return (
      heartRect.left + margin < playerRect.right - margin &&
      heartRect.right - margin > playerRect.left + margin &&
      heartRect.top + margin < playerRect.bottom - margin &&
      heartRect.bottom - margin > playerRect.top + margin
    );
  }

  didCollideRect(other) {
    const heartRect = this.element.getBoundingClientRect();
    const otherRect = other.element.getBoundingClientRect();

    return (
      heartRect.left < otherRect.right &&
      heartRect.right > otherRect.left &&
      heartRect.top < otherRect.bottom &&
      heartRect.bottom > otherRect.top
    );
  }

  remove() {
    this.element.remove();
  }
}
