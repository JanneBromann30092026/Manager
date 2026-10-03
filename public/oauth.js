/* global window, history, document */
// Google sends the access token here (URL fragment). Hand it to the app and remove it from
// the address bar at once. Popup: BroadcastChannel/opener. Redirect: sessionStorage, back to the app.
(function () {
  var fragment = window.location.hash;
  history.replaceState(null, '', window.location.pathname);
  var params = new URLSearchParams(fragment.replace(/^#/, ''));
  var state = params.get('state') || '';
  var mode = state.split('.')[0];
  var message = document.getElementById('message');
  var payload = { type: 'manager-oauth', fragment: fragment };

  if (mode === 'redirect') {
    try {
      sessionStorage.setItem('manager.oauthResult', fragment);
    } catch {
      message.textContent = 'Anmeldung fehlgeschlagen. Bitte in der App erneut versuchen.';
      return;
    }
    window.location.replace('./#/settings?google=1');
    return;
  }

  try {
    var channel = new BroadcastChannel('manager.oauth');
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* not available */
  }
  try {
    if (window.opener) window.opener.postMessage(payload, window.location.origin);
  } catch {
    /* opener gone */
  }
  message.textContent = params.get('error')
    ? 'Anmeldung abgebrochen. Du kannst dieses Fenster schließen.'
    : 'Angemeldet. Du kannst dieses Fenster schließen und zur App zurückkehren.';
  setTimeout(function () {
    window.close();
  }, 400);
})();
