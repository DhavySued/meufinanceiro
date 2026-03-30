Router.register('caixinhas', function (container) {

  var CORES = ['#7e22ce','#059669','#dc2626','#d97706','#0ea5e9','#ec4899','#1e3a8a','#0f766e'];
  var animando      = false;
  var caixinhaAtiva = null;

  function fmtR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function hoje() {
    var d = new Date();
    return String(d.getDate()).padStart(2,'0') + '/' +
           String(d.getMonth() + 1).padStart(2,'0') + '/' +
           d.getFullYear();
  }

  function getSaldo(c) {
    return (c.lancamentos || []).reduce(function (s, l) {
      return s + (l.tipo === 'entrada' ? l.valor : -l.valor);
    }, 0);
  }

  function getSaldoGeral() {
    return AppData.caixinhas.reduce(function (t, c) { return t + getSaldo(c); }, 0);
  }

  // ── Modal: Nova Caixinha ──
  function abrirModalCaixinha() {
    var ant = document.getElementById('modal-cx');
    if (ant) ant.remove();

    var corSel  = CORES[0];
    var admins  = AppData.getFluxoCaixa();
    var optsAdm = '<option value="">— Sem responsável —</option>' +
      admins.map(function (r) {
        return '<option value="' + r.id + '">' + r.nome + '</option>';
      }).join('');

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Nova Caixinha</h3>' +
          '<button class="modal-close" id="btn-fechar-cx">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Nome</label>' +
            '<input type="text" id="cx-nome" placeholder="Ex: Viagem, Reserva de Emergência..." />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Responsável</label>' +
              '<select id="cx-resp">' + optsAdm + '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Meta (opcional)</label>' +
              '<input type="number" id="cx-meta" placeholder="0,00" min="0" step="0.01" />' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Cor</label>' +
            '<div id="cx-cores" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
              CORES.map(function (cor, i) {
                return '<div class="cx-cor-opt' + (i === 0 ? ' cx-cor-sel' : '') + '" data-cor="' + cor + '" ' +
                  'style="width:30px;height:30px;border-radius:50%;background:' + cor + ';cursor:pointer;' +
                  'outline:' + (i === 0 ? '3px solid ' + cor : '3px solid transparent') + ';outline-offset:2px;transition:outline 0.15s"></div>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-cx">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-cx">Criar Caixinha</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    m.querySelectorAll('.cx-cor-opt').forEach(function (el) {
      el.addEventListener('click', function () {
        m.querySelectorAll('.cx-cor-opt').forEach(function (x) { x.style.outline = '3px solid transparent'; });
        el.style.outline = '3px solid ' + el.dataset.cor;
        corSel = el.dataset.cor;
      });
    });

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-fechar-cx').onclick   = fechar;
    document.getElementById('btn-cancelar-cx').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-salvar-cx').onclick = async function () {
      var nome    = document.getElementById('cx-nome').value.trim();
      var meta    = parseFloat(document.getElementById('cx-meta').value) || 0;
      var respRaw = document.getElementById('cx-resp').value;
      var respId  = respRaw ? parseInt(respRaw) : null;
      if (!nome) { alert('Informe o nome da caixinha.'); return; }
      await AppData.addCaixinha({ nome: nome, cor: corSel, meta: meta, responsavelId: respId });
      fechar();
      renderMain(true);
    };
  }

  // ── Modal: Editar Caixinha ──
  function abrirModalEditarCaixinha(c) {
    var ant = document.getElementById('modal-cx-edit');
    if (ant) ant.remove();

    var corSel  = c.cor || CORES[0];
    var admins  = AppData.getFluxoCaixa();
    var optsAdm = '<option value="">— Sem responsável —</option>' +
      admins.map(function (r) {
        return '<option value="' + r.id + '"' + (c.responsavelId === r.id ? ' selected' : '') + '>' + r.nome + '</option>';
      }).join('');

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx-edit';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Editar Caixinha</h3>' +
          '<button class="modal-close" id="btn-fechar-cx-edit">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Nome</label>' +
            '<input type="text" id="cx-edit-nome" value="' + c.nome + '" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Responsável</label>' +
              '<select id="cx-edit-resp">' + optsAdm + '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Meta (opcional)</label>' +
              '<input type="number" id="cx-edit-meta" value="' + (c.meta || '') + '" placeholder="0,00" min="0" step="0.01" />' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Cor</label>' +
            '<div id="cx-edit-cores" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
              CORES.map(function (cor) {
                var sel = cor === corSel;
                return '<div class="cx-cor-opt' + (sel ? ' cx-cor-sel' : '') + '" data-cor="' + cor + '" ' +
                  'style="width:30px;height:30px;border-radius:50%;background:' + cor + ';cursor:pointer;' +
                  'outline:' + (sel ? '3px solid ' + cor : '3px solid transparent') + ';outline-offset:2px;transition:outline 0.15s"></div>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-cx-edit">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-cx-edit">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    m.querySelectorAll('.cx-cor-opt').forEach(function (el) {
      el.addEventListener('click', function () {
        m.querySelectorAll('.cx-cor-opt').forEach(function (x) { x.style.outline = '3px solid transparent'; });
        el.style.outline = '3px solid ' + el.dataset.cor;
        corSel = el.dataset.cor;
      });
    });

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-fechar-cx-edit').onclick   = fechar;
    document.getElementById('btn-cancelar-cx-edit').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-salvar-cx-edit').onclick = async function () {
      var nome    = document.getElementById('cx-edit-nome').value.trim();
      var meta    = parseFloat(document.getElementById('cx-edit-meta').value) || 0;
      var respRaw = document.getElementById('cx-edit-resp').value;
      var respId  = respRaw ? parseInt(respRaw) : null;
      if (!nome) { alert('Informe o nome da caixinha.'); return; }
      await AppData.updateCaixinha(c.id, { nome: nome, cor: corSel, meta: meta, responsavelId: respId });
      fechar();
      var freshC = AppData.caixinhas.find(function (x) { return x.id === c.id; });
      if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
    };
  }

  // ── Modal: Novo Lançamento ──
  function abrirModalLanc() {
    var ant = document.getElementById('modal-cx-lanc');
    if (ant) ant.remove();

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx-lanc';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Novo Lançamento</h3>' +
          '<button class="modal-close" id="btn-fechar-lanc-cx">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Tipo</label>' +
            '<select id="cx-lanc-tipo">' +
              '<option value="entrada">↑ Entrada (depósito)</option>' +
              '<option value="saida">↓ Saída (retirada)</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="cx-lanc-desc" placeholder="Ex: Depósito mensal" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Valor (R$)</label>' +
              '<input type="number" id="cx-lanc-valor" placeholder="0,00" min="0.01" step="0.01" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="text" id="cx-lanc-data" placeholder="DD/MM/AAAA" maxlength="10" value="' + hoje() + '" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-lanc-cx">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-lanc-cx">Adicionar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-fechar-lanc-cx').onclick   = fechar;
    document.getElementById('btn-cancelar-lanc-cx').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-salvar-lanc-cx').onclick = async function () {
      var tipo  = document.getElementById('cx-lanc-tipo').value;
      var desc  = document.getElementById('cx-lanc-desc').value.trim();
      var valor = parseFloat(document.getElementById('cx-lanc-valor').value);
      var data  = document.getElementById('cx-lanc-data').value.trim() || hoje();
      if (!desc || isNaN(valor) || valor <= 0) { alert('Preencha a descrição e o valor.'); return; }
      await AppData.addLancCaixinha(caixinhaAtiva.id, { tipo: tipo, desc: desc, valor: valor, data: data });
      fechar();
      var freshC = AppData.caixinhas.find(function (x) { return x.id === caixinhaAtiva.id; });
      if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
    };
  }

  // ── HTML builders ──

  // Card compacto de caixinha individual dentro de um grupo
  function buildCardHTML(c) {
    var saldo = getSaldo(c);
    var pct   = c.meta > 0 ? Math.min(Math.round((saldo / c.meta) * 100), 100) : -1;
    return '<div class="cx-card-inner" data-id="' + c.id + '">' +
      '<div class="cx-card-inner-row">' +
        '<div class="cx-card-inner-dot" style="background:' + c.cor + '22;color:' + c.cor + '">' +
          '<i class="ph-fill ph-piggy-bank"></i>' +
        '</div>' +
        '<div class="cx-card-inner-nome">' + c.nome + '</div>' +
        '<div class="cx-card-inner-saldo" style="color:' + (saldo < 0 ? 'var(--color-expense)' : 'var(--color-text)') + '">' +
          fmtR(saldo) +
        '</div>' +
        '<i class="ph ph-caret-right cx-card-inner-arrow"></i>' +
      '</div>' +
      (pct >= 0
        ? '<div class="cx-card-inner-progress">' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-muted);margin-bottom:3px">' +
              '<span>Meta: ' + fmtR(c.meta) + '</span><span>' + pct + '%</span>' +
            '</div>' +
            '<div style="height:4px;background:#e2e8f0;border-radius:4px;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + c.cor + ';border-radius:4px;transition:width 0.5s ease"></div>' +
            '</div>' +
          '</div>'
        : '') +
    '</div>';
  }

  function buildMainHTML() {
    var admins     = AppData.getFluxoCaixa();
    var saldoTotal = getSaldoGeral();

    // ── Definição de grupos: Geral + um por responsável ──
    // Cores de destaque por grupo (ícone)
    var GRUPO_CORES = ['#64748b', '#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706'];
    var grupos = [
      { respId: null, titulo: 'Reservas Gerais', icon: 'ph-globe-hemisphere-west', cor: GRUPO_CORES[0] }
    ].concat(admins.map(function (r, i) {
      return { respId: r.id, titulo: r.nome.split(' ')[0], icon: 'ph-user', cor: GRUPO_CORES[(i + 1) % GRUPO_CORES.length] };
    }));

    var gruposHTML = grupos.map(function (g) {
      var lista    = AppData.caixinhas.filter(function (c) {
        return g.respId === null ? !c.responsavelId : c.responsavelId === g.respId;
      });
      var subTotal = lista.reduce(function (t, c) { return t + getSaldo(c); }, 0);

      var innerHTML = lista.length
        ? lista.map(buildCardHTML).join('')
        : '<div class="cx-empty-group">' +
            '<i class="ph ph-piggy-bank" style="font-size:30px;display:block;margin-bottom:8px;opacity:0.25"></i>' +
            'Nenhuma caixinha neste grupo' +
          '</div>';

      return '<div class="cx-grupo">' +
        '<div class="cx-grupo-hdr">' +
          '<div class="cx-grupo-icon" style="background:' + g.cor + '18;color:' + g.cor + '">' +
            '<i class="ph ' + g.icon + '"></i>' +
          '</div>' +
          '<div style="flex:1">' +
            '<div class="cx-grupo-titulo">' + g.titulo + '</div>' +
            '<div class="cx-grupo-sub">' +
              lista.length + ' caixinha' + (lista.length !== 1 ? 's' : '') +
              ' &middot; ' + fmtR(subTotal) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cx-grid-inner">' + innerHTML + '</div>' +
      '</div>';
    }).join('');

    var geralSub = AppData.caixinhas.length + ' caixinha' + (AppData.caixinhas.length !== 1 ? 's' : '') + ' · total acumulado';

    return '<div id="cx-view" class="cx-view-main">' +
      '<div class="page-header">' +
        '<h2>Caixinhas</h2>' +
        '<button class="btn btn-primary" id="btn-nova-cx">+ Nova Caixinha</button>' +
      '</div>' +
      '<div class="cx-geral">' +
        '<div>' +
          '<div class="cx-geral-label">Caixa Geral</div>' +
          '<div class="cx-geral-valor">' + fmtR(saldoTotal) + '</div>' +
          '<div class="cx-geral-sub">' + geralSub + '</div>' +
        '</div>' +
        '<i class="ph-fill ph-piggy-bank" style="font-size:80px;opacity:0.1;align-self:center;flex-shrink:0"></i>' +
      '</div>' +
      '<div class="cx-grupos-wrap">' +
        '<div class="cx-grupos-grid">' + gruposHTML + '</div>' +
      '</div>' +
    '</div>';
  }

  var MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function buildDetalheHTML(c) {
    var saldo = getSaldo(c); // sempre total acumulado, nunca filtrado por mês

    // ── Histórico: aplica filtro de mês se a configuração estiver ativa ──
    var filtroMesAtivo = localStorage.getItem('mf_cx_filtro_mes') === 'true';
    var lancs = (c.lancamentos || []).slice().reverse();

    if (filtroMesAtivo) {
      var mmAtual  = String(AppState.mesIdx + 1).padStart(2, '0');
      var anoAtual = String(AppState.ano);
      lancs = lancs.filter(function (l) {
        if (!l.data) return false;
        var p = l.data.split('/');
        return p[1] === mmAtual && p[2] === anoAtual;
      });
    }

    var resp = c.responsavelId ? AppData.getById(c.responsavelId) : null;

    // Badge indicando o filtro ativo
    var filtroTag = filtroMesAtivo
      ? '<span style="font-size:11px;background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;' +
          'border-radius:20px;padding:2px 10px;font-weight:600">' +
          '<i class="ph ph-funnel" style="margin-right:3px"></i>' +
          MESES_NOME[AppState.mesIdx] + ' ' + AppState.ano +
        '</span>'
      : '<span style="font-size:11px;color:var(--color-muted);font-weight:400">histórico completo</span>';

    var emptyMsg = filtroMesAtivo
      ? 'Nenhum lançamento em ' + MESES_NOME[AppState.mesIdx] + ' ' + AppState.ano + '.<br>' +
        '<span style="font-size:12px">Desative o filtro em Configurações para ver o histórico completo.</span>'
      : 'Nenhum lançamento ainda.<br><span style="font-size:12px">Use "+ Lançamento" para depositar ou retirar.</span>';

    var linhasHTML = lancs.length
      ? lancs.map(function (l) {
          var ent = l.tipo === 'entrada';
          return '<tr>' +
            '<td style="color:var(--color-muted);font-size:13px">' + l.data + '</td>' +
            '<td><strong>' + l.desc + '</strong></td>' +
            '<td><span class="badge" style="background:' + (ent ? 'var(--color-income-bg)' : 'var(--color-expense-bg)') + ';color:' + (ent ? 'var(--color-income)' : 'var(--color-expense)') + '">' + (ent ? 'Entrada' : 'Saída') + '</span></td>' +
            '<td class="' + (ent ? 'amount-income' : 'amount-expense') + '">' + (ent ? '+' : '-') + fmtR(l.valor) + '</td>' +
            '<td><button class="btn-del-lanc-cx" data-id="' + l.id + '" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:18px;line-height:1" title="Remover">×</button></td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--color-muted);padding:36px 22px">' + emptyMsg + '</td></tr>';

    return '<div id="cx-view">' +
      '<div class="cx-detail-hdr" style="background:' + c.cor + '">' +
        '<button id="cx-back" class="cx-btn-ghost"><i class="ph ph-arrow-left"></i> Voltar</button>' +
        '<div style="flex:1;text-align:center">' +
          '<div style="color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px">' + c.nome + '</div>' +
          '<div style="color:#fff;font-size:32px;font-weight:800;margin-top:2px">' + fmtR(saldo) + '</div>' +
          '<div style="color:rgba(255,255,255,0.65);font-size:11px;margin-top:2px">saldo total acumulado</div>' +
          (c.meta > 0 ? '<div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px">Meta: ' + fmtR(c.meta) + '</div>' : '') +
          (resp ? '<div style="margin-top:8px"><span style="display:inline-block;padding:3px 14px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(255,255,255,0.2);color:#fff"><i class="ph ph-user" style="margin-right:5px"></i>' + resp.nome + '</span></div>' : '') +
        '</div>' +
        '<button id="btn-add-lanc-cx" class="cx-btn-ghost"><i class="ph ph-plus"></i> Lançamento</button>' +
      '</div>' +

      '<div class="section-box" style="margin-top:18px">' +
        '<div class="section-box-header">' +
          '<h2>Lançamentos &nbsp;' + filtroTag + '</h2>' +
          '<div style="display:flex;gap:8px">' +
            '<button id="btn-editar-cx" style="background:var(--color-primary-light);color:var(--color-primary);border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600"><i class="ph ph-pencil" style="margin-right:4px"></i>Editar</button>' +
            '<button id="btn-excluir-cx" style="background:var(--color-expense-bg);color:var(--color-expense);border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600">Excluir Caixinha</button>' +
          '</div>' +
        '</div>' +
        '<table class="data-table zebra">' +
          '<thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th></th></tr></thead>' +
          '<tbody>' + linhasHTML + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  // ── Render com animação ──
  function renderMain(reentrada) {
    container.innerHTML = buildMainHTML();
    var v = document.getElementById('cx-view');
    v.classList.add(reentrada ? 'cx-anim-in-left' : 'cx-anim-in-right');
    bindMain();
  }

  function renderDetalhe(c, comAnim) {
    container.innerHTML = buildDetalheHTML(c);
    if (comAnim !== false) {
      document.getElementById('cx-view').classList.add('cx-anim-in-right');
    }
    bindDetalhe(c);
  }

  function irParaCaixinha(c) {
    if (animando) return;
    animando = true;
    caixinhaAtiva = c;
    var v = document.getElementById('cx-view');
    v.classList.add('cx-anim-out-left');
    setTimeout(function () { animando = false; renderDetalhe(c, true); }, 280);
  }

  function voltarParaMain() {
    if (animando) return;
    animando = true;
    var v = document.getElementById('cx-view');
    v.classList.add('cx-anim-out-right');
    setTimeout(function () {
      animando = false;
      caixinhaAtiva = null;
      renderMain(true);
    }, 280);
  }

  // ── Bind ──
  function bindMain() {
    document.getElementById('btn-nova-cx').addEventListener('click', abrirModalCaixinha);

    // Event delegation: clique em qualquer cx-card-inner em qualquer grupo
    document.getElementById('cx-view').addEventListener('click', function (e) {
      var card = e.target.closest('.cx-card-inner');
      if (!card) return;
      var c = AppData.caixinhas.find(function (x) { return x.id === parseInt(card.dataset.id); });
      if (c) irParaCaixinha(c);
    });
  }

  function bindDetalhe(c) {
    document.getElementById('cx-back').addEventListener('click', voltarParaMain);

    document.getElementById('btn-add-lanc-cx').addEventListener('click', abrirModalLanc);

    document.getElementById('btn-editar-cx').addEventListener('click', function () {
      abrirModalEditarCaixinha(c);
    });

    document.getElementById('btn-excluir-cx').addEventListener('click', async function () {
      if (!confirm('Excluir a caixinha "' + c.nome + '"?\nTodos os lançamentos serão perdidos.')) return;
      await AppData.removeCaixinha(c.id);
      caixinhaAtiva = null;
      voltarParaMain();
    });

    var tbody = document.querySelector('#cx-view tbody');
    if (tbody) {
      tbody.addEventListener('click', async function (e) {
        var btn = e.target.closest('.btn-del-lanc-cx');
        if (!btn) return;
        if (!confirm('Remover este lançamento?')) return;
        await AppData.removeLancCaixinha(c.id, parseInt(btn.dataset.id));
        var freshC = AppData.caixinhas.find(function (x) { return x.id === c.id; });
        if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
      });
    }
  }

  // ── Init ──
  renderMain(false);
});
