(function () {
  var script = document.currentScript;
  if (!script) return;
  var key    = script.dataset.key || '';
  var width  = script.dataset.width  || '400px';
  var height = script.dataset.height || '480px';

  var origin = script.src
    ? (new URL(script.src)).origin
    : 'https://signalgrade.com';

  var iframe = document.createElement('iframe');
  iframe.src    = origin + '/widget?key=' + encodeURIComponent(key);
  iframe.width  = width;
  iframe.height = height;
  iframe.style.border  = 'none';
  iframe.style.display = 'block';
  iframe.allow  = '';
  iframe.title  = 'SignalGrade Audit Widget';

  script.parentNode.insertBefore(iframe, script.nextSibling);
})();
