const FRAMES = ['|', '/', '-', '\\'];

/** Terminal spinner — works while other async work runs (not with spawnSync). */
export function createSpinner(initialLabel = 'Working...') {
  let label = initialLabel;
  let frame = 0;
  let timer = null;

  function render() {
    const f = FRAMES[frame % FRAMES.length];
    process.stdout.write(`\r  ${f} ${label}`);
    frame++;
  }

  return {
    start() {
      if (timer) return;
      render();
      timer = setInterval(render, 150);
    },
    update(nextLabel) {
      label = nextLabel;
    },
    stop(finalLabel) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      const text = finalLabel ?? label;
      process.stdout.write(`\r  [OK] ${text}\n`);
    },
    fail(message) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write(`\r  [FAIL] ${message}\n`);
    },
  };
}
