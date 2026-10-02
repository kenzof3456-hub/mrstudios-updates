function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).then((value) => {
    clearTimeout(timer);
    return value;
  });
}

module.exports = { withTimeout };
