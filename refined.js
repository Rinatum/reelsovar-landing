// This readout follows the real video; it is deliberately not a mock scrubber.
(() => {
  const players = [...document.querySelectorAll('.hero-loop')];
  const track = document.querySelector('.playback-track');
  const current = document.querySelector('.playback-time');
  const duration = document.querySelector('.playback-duration');
  const format = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;
  function sync() {
    const video = players.find(v => v.classList.contains('is-active'));
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    track.style.setProperty('--played', total ? video.currentTime / total : 0);
    current.textContent = format(video.currentTime);
    if (total) duration.textContent = format(total);
  }
  players.forEach(v => ['timeupdate','loadedmetadata','play','pause'].forEach(event => v.addEventListener(event,sync)));
  document.querySelectorAll('.moment-choice').forEach(b => b.addEventListener('click',sync));
  sync();
})();
