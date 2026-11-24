// Keyboard and mouse input. Held keys for movement/sprint, one-shot actions queued as a
// bitmask, mouse for aiming and click for firing. Blur releases all held keys.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;
export const ACTION_SWITCH = 16;

const MOVE_LEFT = new Set(['ArrowLeft', 'KeyA']);
const MOVE_RIGHT = new Set(['ArrowRight', 'KeyD']);
const MOVE_UP = new Set(['ArrowUp', 'KeyW']);
const MOVE_DOWN = new Set(['ArrowDown', 'KeyS']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const WEAPON_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };

export function createInput(canvas) {
  let left = false, right = false, up = false, down = false;
  let sprint = false;
  let actions = 0;
  let mouseX = 0, mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let switchTo = -1;

  window.addEventListener('keydown', (event) => {
    if (MOVE_LEFT.has(event.code)) left = true;
    else if (MOVE_RIGHT.has(event.code)) right = true;
    else if (MOVE_UP.has(event.code)) up = true;
    else if (MOVE_DOWN.has(event.code)) down = true;
    else if (SPRINT.has(event.code)) sprint = true;
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (RELOAD.has(event.code)) { if (!event.repeat) actions |= ACTION_RELOAD; }
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (WEAPON_KEYS[event.code] !== undefined) { switchTo = WEAPON_KEYS[event.code]; actions |= ACTION_SWITCH; }
    else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (MOVE_LEFT.has(event.code)) left = false;
    else if (MOVE_RIGHT.has(event.code)) right = false;
    else if (MOVE_UP.has(event.code)) up = false;
    else if (MOVE_DOWN.has(event.code)) down = false;
    else if (SPRINT.has(event.code)) sprint = false;
  });

  window.addEventListener('blur', () => { left = false; right = false; up = false; down = false; sprint = false; });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (event.clientX - rect.left) * scaleX;
    mouseY = (event.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    mouseClicked = true;
    event.preventDefault();
  });

  canvas.addEventListener('mouseup', () => { mouseDown = false; });

  canvas.addEventListener('wheel', (event) => {
    switchTo = -1 - (event.deltaY > 0 ? 1 : -1);
    actions |= ACTION_SWITCH;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    moveX() { return (right ? 1 : 0) - (left ? 1 : 0); },
    moveY() { return (down ? 1 : 0) - (up ? 1 : 0); },
    isSprint() { return sprint; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
    consumeClick() { mouseClicked = false; },
    consumeSwitch() { const v = switchTo; switchTo = -1; return v; },
  };
}