var Router = (function () {
  var routes = {};

  var pageTitles = {
    'dashboard':        'Dashboard',
    'cartoes':          'Cartões',
    'lancamentos':      'Lançamentos',
    'mes-a-mes':        'DRE · Mês a Mês',
    'cad-categorias':   'Cadastro · Categorias',
    'cad-cartoes':      'Cadastro · Cartões',
    'cad-responsaveis': 'Cadastro · Responsáveis',
    'caixinhas':        'Caixinhas',
    'importacao':       'Importação',
    'configuracoes':    'Configurações',
    'orcamento':        'Orçamento',
  };

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function navigate(name) {
    window.location.hash = name;
  }

  function resolve() {
    var hash = window.location.hash.replace('#', '') || 'dashboard';
    var renderFn = routes[hash] || routes['dashboard'];
    var container = document.getElementById('app-content');

    // Remove modais que ficaram no body de páginas anteriores
    document.querySelectorAll('body > .modal-overlay').forEach(function (m) { m.remove(); });

    if (renderFn && container) {
      container.innerHTML = '';
      renderFn(container);
      // Dispara animação de entrada em toda troca de página
      container.classList.remove('page-enter');
      void container.offsetWidth; // força reflow para reiniciar a animação
      container.classList.add('page-enter');
    }

    // Atualiza título
    var titleEl = document.getElementById('page-title');
    if (titleEl) {
      titleEl.textContent = pageTitles[hash] || 'Dashboard';
    }

    // Atualiza link ativo na sidebar
    var links = document.querySelectorAll('.nav-link');
    links.forEach(function (link) {
      link.classList.toggle('active', link.dataset.page === hash);
    });

    // Abre o submenu de Cadastro se uma sub-página estiver ativa
    var cadGroup = document.getElementById('nav-cadastro');
    if (cadGroup) {
      cadGroup.open = hash.startsWith('cad-');
    }

    // Fecha sidebar no mobile
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Fecha sidebar overlay
    var overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('visible');

    // Atualiza bottom nav ativo
    var bottomItems = document.querySelectorAll('.bottom-nav-item');
    bottomItems.forEach(function (item) {
      item.classList.toggle('active', item.dataset.page === hash);
    });
  }

  function init() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  function refresh() { resolve(); }

  return { register: register, navigate: navigate, init: init, refresh: refresh };
})();
