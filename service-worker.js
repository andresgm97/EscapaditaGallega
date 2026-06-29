<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0" />
  <meta name="theme-color" content="#0f2a33" />
  <meta name="description" content="Entre mar, vino y atardeceres — un fin de semana por las Rías Baixas." />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Entre mar, vino y atardeceres" />
  <title>Entre mar, vino y atardeceres</title>
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="assets/icons/icon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Inter:wght@400;500;600&display=swap" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- Animated coastal background -->
  <div class="bg" aria-hidden="true">
    <video class="bg__video" id="bgVideo" autoplay muted loop playsinline preload="none" poster="assets/images/poster.svg"></video>
    <canvas class="bg__canvas" id="bgCanvas"></canvas>
    <div class="bg__static"></div>
    <div class="bg__overlay"></div>
  </div>

  <a class="skip-link" href="#main">Saltar al contenido</a>

  <!-- ============ COVER ============ -->
  <section class="cover" id="cover" aria-label="Portada">
    <div class="cover__inner">
      <p class="cover__eyebrow">Un fin de semana por las Rías Baixas</p>
      <h1 class="cover__title">Entre mar,<br />vino y atardeceres</h1>
      <p class="cover__sub">Una escapada que se descubre capítulo a capítulo.</p>
      <button class="btn btn--primary cover__cta" id="startBtn">Comenzar</button>
    </div>
    <div class="cover__hint" aria-hidden="true">Desliza para descubrir</div>
  </section>

  <!-- ============ MAIN / PLANS ============ -->
  <main class="app hidden" id="main" tabindex="-1">
    <header class="topbar">
      <button class="iconbtn" id="homeBtn" aria-label="Volver a la portada">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3 10.5V21h6v-6h6v6h6V10.5z"/></svg>
      </button>
      <div class="progress" id="progress" role="group" aria-label="Progreso del viaje">
        <div class="progress__track"><div class="progress__fill" id="progressFill"></div></div>
        <span class="progress__label" id="progressLabel">Capítulo 1</span>
      </div>
      <div class="topbar__spacer"></div>
    </header>

    <div class="deck" id="deck" aria-live="polite">
      <!-- Cards injected here -->
    </div>

    <nav class="navbar" aria-label="Navegación entre capítulos">
      <button class="iconbtn navbtn" id="prevBtn" aria-label="Capítulo anterior">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
      </button>
      <div class="dots" id="dots" aria-hidden="true"></div>
      <button class="iconbtn navbtn" id="nextBtn" aria-label="Capítulo siguiente">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="m8.6 7.4 1.4-1.4 6 6-6 6-1.4-1.4 4.6-4.6z"/></svg>
      </button>
    </nav>

    <footer class="footer">
      <button class="admin-trigger" id="adminTrigger" aria-label="Acceso reservado">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" opacity=".9"/><circle cx="12" cy="10" r="1.3" fill="#0f2a33"/></svg>
      </button>
    </footer>
  </main>

  <!-- ============ ADMIN PIN MODAL ============ -->
  <div class="modal hidden" id="pinModal" role="dialog" aria-modal="true" aria-labelledby="pinTitle">
    <div class="modal__backdrop" data-close></div>
    <div class="modal__panel">
      <h2 class="modal__title" id="pinTitle">Acceso reservado</h2>
      <p class="modal__text">Introduce el código para continuar.</p>
      <div class="pin" id="pinDots" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="pin__error" id="pinError" role="alert"></p>
      <div class="keypad" id="keypad">
        <button class="key">1</button><button class="key">2</button><button class="key">3</button>
        <button class="key">4</button><button class="key">5</button><button class="key">6</button>
        <button class="key">7</button><button class="key">8</button><button class="key">9</button>
        <button class="key key--ghost" data-action="clear">Borrar</button>
        <button class="key">0</button>
        <button class="key key--ghost" data-action="del" aria-label="Eliminar último dígito">⌫</button>
      </div>
      <button class="btn btn--ghost modal__close" data-close>Cancelar</button>
    </div>
  </div>

  <!-- ============ ADMIN PANEL ============ -->
  <div class="modal hidden" id="adminModal" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
    <div class="modal__backdrop" data-close></div>
    <div class="modal__panel modal__panel--wide">
      <div class="admin__head">
        <h2 class="modal__title" id="adminTitle">Panel de administrador</h2>
        <button class="iconbtn" data-close aria-label="Cerrar panel">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" transform="translate(0.5 0)"/></svg>
        </button>
      </div>
      <div class="admin__actions">
        <button class="btn btn--soft" data-admin="unlockAll">Desbloquear todo</button>
        <button class="btn btn--soft" data-admin="lockAll">Bloquear todo salvo el primero</button>
        <button class="btn btn--soft" data-admin="resetTasting">Reiniciar puntuaciones</button>
        <button class="btn btn--danger" data-admin="resetAll">Resetear todo el progreso</button>
      </div>
      <h3 class="admin__subtitle">Planes del viaje</h3>
      <ul class="admin__list" id="adminList"></ul>
    </div>
  </div>

  <!-- ============ TOAST ============ -->
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script src="app.js"></script>
</body>
</html>
