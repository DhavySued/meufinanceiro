// ── Estado global de competência ────────────────────────────
var AppState = (function () {
  var saved = localStorage.getItem('mf_competencia');
  var mesIdx = new Date().getMonth();
  var ano    = new Date().getFullYear();

  if (saved) {
    var p = saved.split('/');
    if (p.length === 2) { mesIdx = parseInt(p[0]); ano = parseInt(p[1]); }
  }

  return {
    mesIdx: mesIdx,
    ano:    ano,
    set: function (m, a) {
      this.mesIdx = m;
      this.ano    = a;
      localStorage.setItem('mf_competencia', m + '/' + a);
      // Mantém o seletor do header em sincronia; garante que a opção exista
      var sel = document.getElementById('sel-competencia-global');
      if (sel) {
        var val = m + '/' + a;
        if (!sel.querySelector('option[value="' + val + '"]')) {
          var MESES_S = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                         'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
          var opt = document.createElement('option');
          opt.value = val;
          opt.textContent = MESES_S[m] + ' ' + a;
          sel.appendChild(opt);
        }
        sel.value = val;
      }
    }
  };
})();

document.addEventListener('DOMContentLoaded', async function () {
  var container = document.getElementById('app-content');
  if (container) container.innerHTML = '<p style="padding:2rem;color:#888">Carregando...</p>';

  try {
    await AppData.init();
  } catch (e) {
    console.error('Erro ao inicializar dados:', e);
    if (container) container.innerHTML = '<p style="padding:2rem;color:#ef4444">Erro ao conectar com o banco de dados. Verifique o console.</p>';
    return;
  }

  // ── Seletor de competência com navegação por setas ──
  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Garante que uma opção exista no select para m/a; retorna o value
  function garantirOpcao(sel, m, a) {
    var val = m + '/' + a;
    if (!sel.querySelector('option[value="' + val + '"]')) {
      var opt = document.createElement('option');
      opt.value = val;
      opt.textContent = MESES[m] + ' ' + a;
      // Insere na posição correta (cronológica)
      var inserido = false;
      for (var k = 0; k < sel.options.length; k++) {
        var p = sel.options[k].value.split('/');
        var om = parseInt(p[0]), oa = parseInt(p[1]);
        if (a < oa || (a === oa && m < om)) {
          sel.insertBefore(opt, sel.options[k]);
          inserido = true;
          break;
        }
      }
      if (!inserido) sel.appendChild(opt);
    }
    return val;
  }

  function navegarMes(delta) {
    var m = AppState.mesIdx + delta;
    var a = AppState.ano;
    if (m < 0)  { m = 11; a--; }
    if (m > 11) { m = 0;  a++; }
    var sel = document.getElementById('sel-competencia-global');
    if (sel) sel.value = garantirOpcao(sel, m, a);
    AppState.set(m, a);
    Router.refresh();
  }

  // Gera opções cobrindo 3 anos atrás até 1 ano à frente
  var hoje = new Date();
  var opts = '';
  for (var i = -36; i <= 12; i++) {
    var d    = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    var mIdx = d.getMonth();
    var a    = d.getFullYear();
    var sel  = (mIdx === AppState.mesIdx && a === AppState.ano) ? ' selected' : '';
    opts += '<option value="' + mIdx + '/' + a + '"' + sel + '>' + MESES[mIdx] + ' ' + a + '</option>';
  }

  var selComp = document.createElement('select');
  selComp.id = 'sel-competencia-global';
  selComp.innerHTML = opts;
  selComp.title = 'Clique para escolher um mês específico';

  selComp.addEventListener('change', function () {
    var p = this.value.split('/');
    AppState.set(parseInt(p[0]), parseInt(p[1]));
    Router.refresh();
  });

  var btnAnt = document.createElement('button');
  btnAnt.id = 'btn-comp-ant';
  btnAnt.className = 'comp-nav-btn';
  btnAnt.title = 'Mês anterior';
  btnAnt.innerHTML = '<i class="ph ph-caret-left" style="pointer-events:none"></i>';
  btnAnt.addEventListener('click', function () { navegarMes(-1); });

  var btnProx = document.createElement('button');
  btnProx.id = 'btn-comp-prox';
  btnProx.className = 'comp-nav-btn';
  btnProx.title = 'Próximo mês';
  btnProx.innerHTML = '<i class="ph ph-caret-right" style="pointer-events:none"></i>';
  btnProx.addEventListener('click', function () { navegarMes(+1); });

  var compNav = document.createElement('div');
  compNav.className = 'comp-nav';
  compNav.appendChild(btnAnt);
  compNav.appendChild(selComp);
  compNav.appendChild(btnProx);

  var topBarRight = document.querySelector('.top-bar-right');
  if (topBarRight) topBarRight.insertBefore(compNav, topBarRight.firstChild);

  Router.init();

  var hamburger       = document.getElementById('hamburger');
  var sidebar         = document.getElementById('sidebar');
  var sidebarOverlay  = document.getElementById('sidebar-overlay');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', function () {
      var isOpen = sidebar.classList.toggle('open');
      if (sidebarOverlay) sidebarOverlay.classList.toggle('visible', isOpen);
    });
  }

  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('visible');
    });
  }

  // ── FAB: Novo Lançamento ──────────────────────────────────────
  var fab = document.getElementById('fab-novo-lancamento');
  if (fab) {
    fab.addEventListener('click', function () {
      var hash = window.location.hash.replace('#', '');
      if (hash === 'lancamentos') {
        // Já está na página, abre o modal diretamente
        var btn = document.getElementById('btn-novo-lancamento');
        if (btn) btn.click();
      } else {
        // Sinaliza para a página abrir o modal após renderizar
        window._mfFabOpenLancamento = true;
        Router.navigate('lancamentos');
      }
    });
  }

  // ── Swipe-to-close nos Bottom Sheets ─────────────────────────
  (function () {
    var startY = 0;
    var target = null;

    function isMobile() { return window.innerWidth <= 768; }

    function getSheet(el) {
      // Retorna o overlay e o card se o toque começou no header/handle do sheet
      var overlay = el.closest('.modal-overlay.open') || el.closest('.drill-overlay.drill-overlay-in');
      if (!overlay) return null;
      var card = overlay.querySelector('.modal, .drill-card');
      return card ? { overlay: overlay, card: card } : null;
    }

    document.addEventListener('touchstart', function (e) {
      if (!isMobile()) return;
      startY = e.touches[0].clientY;
      var sh = getSheet(e.target);
      target = sh || null;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!isMobile() || !target) return;
      var endY = e.changedTouches[0].clientY;
      var diff = endY - startY;
      if (diff > 72) {
        // Deslizou para baixo: fechar o sheet
        var overlay = target.overlay;
        overlay.classList.add('sheet-closing');
        setTimeout(function () {
          overlay.classList.remove('open', 'drill-overlay-in', 'sheet-closing');
        }, 250);
      }
      target = null;
    }, { passive: true });
  }());
});
