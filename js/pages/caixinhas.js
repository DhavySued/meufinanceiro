Router.register('caixinhas', function (container) {

  var CORES = ['#7e22ce','#059669','#dc2626','#d97706','#0ea5e9','#ec4899','#1e3a8a','#0f766e'];
  var animando      = false;
  var caixinhaAtiva = null;

  // ── Caixinhas ocultas (localStorage) ──
  function getOcultas() {
    try { return JSON.parse(localStorage.getItem('mf_cx_ocultas') || '[]'); } catch(e) { return []; }
  }
  function setOcultas(arr) {
    localStorage.setItem('mf_cx_ocultas', JSON.stringify(arr));
  }
  function isOculta(id) {
    return getOcultas().indexOf(id) !== -1;
  }
  function ocultarCaixinha(id) {
    var arr = getOcultas();
    if (arr.indexOf(id) === -1) arr.push(id);
    setOcultas(arr);
  }
  function mostrarCaixinhaId(id) {
    setOcultas(getOcultas().filter(function(x) { return x !== id; }));
  }

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

  // ── Modal: Editar Lançamento ──
  function abrirModalEditarLanc(l) {
    var ant = document.getElementById('modal-cx-lanc-edit');
    if (ant) ant.remove();

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx-lanc-edit';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Editar Lançamento</h3>' +
          '<button class="modal-close" id="btn-fechar-lanc-edit">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Tipo</label>' +
            '<select id="cx-lanc-edit-tipo">' +
              '<option value="entrada"' + (l.tipo === 'entrada' ? ' selected' : '') + '>↑ Entrada (depósito)</option>' +
              '<option value="saida"'   + (l.tipo === 'saida'   ? ' selected' : '') + '>↓ Saída (retirada)</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="cx-lanc-edit-desc" value="' + l.desc.replace(/"/g, '&quot;') + '" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Valor (R$)</label>' +
              '<input type="number" id="cx-lanc-edit-valor" value="' + l.valor + '" min="0.01" step="0.01" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="text" id="cx-lanc-edit-data" maxlength="10" value="' + l.data + '" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-lanc-edit">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-lanc-edit">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-fechar-lanc-edit').onclick   = fechar;
    document.getElementById('btn-cancelar-lanc-edit').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-salvar-lanc-edit').onclick = async function () {
      var tipo  = document.getElementById('cx-lanc-edit-tipo').value;
      var desc  = document.getElementById('cx-lanc-edit-desc').value.trim();
      var valor = parseFloat(document.getElementById('cx-lanc-edit-valor').value);
      var data  = document.getElementById('cx-lanc-edit-data').value.trim() || hoje();
      if (!desc || isNaN(valor) || valor <= 0) { alert('Preencha a descrição e o valor.'); return; }
      await AppData.updateLancCaixinha(caixinhaAtiva.id, l.id, { tipo: tipo, desc: desc, valor: valor, data: data });
      fechar();
      var freshC = AppData.caixinhas.find(function (x) { return x.id === caixinhaAtiva.id; });
      if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
    };
  }

  // ── Modal: Transferência entre caixinhas ──
  function abrirModalTransferencia(origem) {
    var ant = document.getElementById('modal-cx-transf');
    if (ant) ant.remove();

    var outras = AppData.caixinhas.filter(function (c) { return c.id !== origem.id; });
    if (!outras.length) {
      alert('Não há outras caixinhas disponíveis. Crie mais caixinhas para transferir.');
      return;
    }

    var optsDestino = outras.map(function (c) {
      return '<option value="' + c.id + '">' + c.nome + ' (' + fmtR(getSaldo(c)) + ')</option>';
    }).join('');

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx-transf';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Transferir Valor</h3>' +
          '<button class="modal-close" id="btn-fechar-transf">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div style="display:flex;align-items:center;gap:8px;background:var(--color-primary-light);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--color-primary)">' +
            '<i class="ph ph-arrows-left-right" style="font-size:16px;flex-shrink:0"></i>' +
            '<span>Saída de <strong>' + origem.nome + '</strong> → entrada na caixinha selecionada</span>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Caixinha destino</label>' +
            '<select id="cx-transf-destino">' + optsDestino + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="cx-transf-desc" placeholder="Ex: Remanejamento de verba" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Valor (R$)</label>' +
              '<input type="number" id="cx-transf-valor" placeholder="0,00" min="0.01" step="0.01" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="text" id="cx-transf-data" placeholder="DD/MM/AAAA" maxlength="10" value="' + hoje() + '" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-transf">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-transf"><i class="ph ph-arrows-left-right" style="margin-right:5px"></i>Transferir</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-fechar-transf').onclick   = fechar;
    document.getElementById('btn-cancelar-transf').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-salvar-transf').onclick = async function () {
      var destinoId = parseInt(document.getElementById('cx-transf-destino').value);
      var desc      = document.getElementById('cx-transf-desc').value.trim();
      var valor     = parseFloat(document.getElementById('cx-transf-valor').value);
      var data      = document.getElementById('cx-transf-data').value.trim() || hoje();
      if (!desc || isNaN(valor) || valor <= 0) { alert('Preencha a descrição e o valor.'); return; }
      var destino = AppData.caixinhas.find(function (c) { return c.id === destinoId; });
      if (!destino) return;

      var btn = document.getElementById('btn-salvar-transf');
      btn.disabled = true;
      btn.textContent = 'Transferindo...';

      await AppData.addLancCaixinha(origem.id, {
        tipo: 'saida', desc: desc, valor: valor, data: data,
        tag: 'transferencia', paraCx: destino.nome
      });
      await AppData.addLancCaixinha(destino.id, {
        tipo: 'entrada', desc: desc, valor: valor, data: data,
        tag: 'transferencia', deCx: origem.nome
      });

      fechar();
      var freshC = AppData.caixinhas.find(function (x) { return x.id === origem.id; });
      if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
    };
  }

  // ── Modal: Caixinhas ocultas ──
  function abrirModalOcultas() {
    var ant = document.getElementById('modal-cx-ocultas');
    if (ant) ant.remove();

    var ocultas = getOcultas();
    var lista = AppData.caixinhas.filter(function (c) { return ocultas.indexOf(c.id) !== -1; });

    function buildLinhas() {
      return lista.length
        ? lista.map(function (c) {
            var saldo = getSaldo(c);
            return '<div class="cx-oculta-item" data-id="' + c.id + '" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border)">' +
              '<div style="width:34px;height:34px;border-radius:50%;background:' + c.cor + '22;color:' + c.cor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
                '<i class="ph-fill ph-piggy-bank"></i>' +
              '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:600;font-size:14px">' + c.nome + '</div>' +
                '<div style="font-size:12px;color:var(--color-muted)">' + fmtR(saldo) + '</div>' +
              '</div>' +
              '<button class="btn btn-outline btn-mostrar-cx" data-id="' + c.id + '" style="font-size:12px;padding:4px 14px;white-space:nowrap">Mostrar</button>' +
            '</div>';
          }).join('')
        : '<div style="text-align:center;color:var(--color-muted);padding:28px 0">Nenhuma caixinha oculta no momento.</div>';
    }

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-cx-ocultas';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Caixinhas Ocultas</h3>' +
          '<button class="modal-close" id="btn-fechar-ocultas">&times;</button>' +
        '</div>' +
        '<div class="modal-body" id="cx-ocultas-body">' + buildLinhas() + '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-fechar-ocultas-2">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    var alterou = false;
    function fechar() {
      m.classList.remove('open');
      setTimeout(function () {
        m.remove();
        if (alterou) renderMain(true);
      }, 300);
    }
    document.getElementById('btn-fechar-ocultas').onclick   = fechar;
    document.getElementById('btn-fechar-ocultas-2').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    m.querySelector('#cx-ocultas-body').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-mostrar-cx');
      if (!btn) return;
      var id = parseInt(btn.dataset.id);
      mostrarCaixinhaId(id);
      alterou = true;
      lista = lista.filter(function (c) { return c.id !== id; });
      document.getElementById('cx-ocultas-body').innerHTML = buildLinhas();
    });
  }

  // ── Popup: Separar Fatura para Caixinha ──

  function getDespCartaoRespValor(mesIdx, respId, cartaoId) {
    var mesRef = String(AppState.ano) + '-' + String(mesIdx + 1).padStart(2, '0');
    var lancs = AppData.getLancamentos().filter(function (l) {
      if (l.cartaoId !== cartaoId) return false;
      if (AppData.getMesRef(l) !== mesRef) return false;
      if (l.isDividido && l.splits) {
        return l.splits.some(function (s) { return s.respId === respId; });
      }
      return l.responsavelId === respId;
    });
    var total = lancs.reduce(function (s, l) {
      var v;
      if (l.isDividido && l.splits) {
        var sp = l.splits.find(function (x) { return x.respId === respId; });
        v = sp ? Math.abs(sp.valor) : 0;
      } else {
        v = Math.abs(l.valor);
      }
      return s + (l.tipo === 'receita' ? -v : v);
    }, 0);
    return Math.max(0, total);
  }

  function abrirModalSepararFatura() {
    var ant = document.getElementById('modal-sep-fatura');
    if (ant) ant.remove();

    var mesIdx  = AppState.mesIdx;
    var mesNome = MESES_NOME[mesIdx] + ' ' + AppState.ano;

    var admins  = AppData.getFluxoCaixa();
    var cartoes = AppData.cartoes;

    if (!admins.length)  { alert('Nenhum responsável cadastrado.');  return; }
    if (!cartoes.length) { alert('Nenhum cartão cadastrado.'); return; }

    var optsResp = admins.map(function (r) {
      return '<option value="' + r.id + '">' + r.nome + '</option>';
    }).join('');

    var optsCartao = cartoes.map(function (c) {
      return '<option value="' + c.id + '">' + c.nome + '</option>';
    }).join('');

    var optsCaixinha = '<option value="nova">+ Criar nova caixinha</option>' +
      AppData.caixinhas.map(function (c) {
        return '<option value="' + c.id + '">' + c.nome + ' (' + fmtR(getSaldo(c)) + ')</option>';
      }).join('');

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-sep-fatura';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3><i class="ph ph-piggy-bank" style="margin-right:6px"></i>Separar Fatura para Caixinha</h3>' +
          '<button class="modal-close" id="btn-sf-fechar">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div style="display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#3b82f6;' +
               'border:1px solid #bfdbfe;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin-bottom:16px">' +
            '<i class="ph ph-calendar"></i>&nbsp;' + mesNome +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Responsável</label>' +
              '<select id="sf-resp">' + optsResp + '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Cartão</label>' +
              '<select id="sf-cartao">' + optsCartao + '</select>' +
            '</div>' +
          '</div>' +
          '<div id="sf-dre-box" style="border-radius:10px;padding:12px 16px;margin-bottom:14px;' +
               'display:flex;align-items:center;justify-content:space-between;transition:background .2s,border-color .2s;' +
               'background:#f0fdf4;border:1px solid #bbf7d0">' +
            '<div>' +
              '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#15803d">Valor da DRE</div>' +
              '<div id="sf-dre-valor" style="font-size:20px;font-weight:800;color:#15803d">R$ 0,00</div>' +
            '</div>' +
            '<i class="ph-fill ph-receipt" style="font-size:28px;color:#86efac"></i>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Valor a separar (R$)</label>' +
              '<input type="number" id="sf-valor" placeholder="0,00" min="0" step="0.01" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="text" id="sf-data" maxlength="10" value="' + hoje() + '" />' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Caixinha destino</label>' +
            '<select id="sf-caixinha">' + optsCaixinha + '</select>' +
          '</div>' +
          '<div id="sf-nova-grupo" class="form-group" style="display:none">' +
            '<label>Nome da nova caixinha</label>' +
            '<input type="text" id="sf-nova-nome" placeholder="Ex: Nubank" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição do lançamento</label>' +
            '<input type="text" id="sf-desc" />' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-sf-cancelar">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-sf-salvar">' +
            '<i class="ph ph-piggy-bank" style="margin-right:5px"></i>Separar' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    function getResp()   { return parseInt(document.getElementById('sf-resp').value); }
    function getCartao() { return parseInt(document.getElementById('sf-cartao').value); }

    function atualizarDRE() {
      var v      = getDespCartaoRespValor(mesIdx, getResp(), getCartao());
      var dreEl  = document.getElementById('sf-dre-valor');
      var dreBox = document.getElementById('sf-dre-box');
      dreEl.textContent         = fmtR(v);
      dreEl.style.color         = v > 0 ? '#15803d' : '#9ca3af';
      dreBox.style.background   = v > 0 ? '#f0fdf4' : '#f8fafc';
      dreBox.style.borderColor  = v > 0 ? '#bbf7d0' : '#e2e8f0';
      document.getElementById('sf-valor').value = v > 0 ? v.toFixed(2) : '';
      atualizarDescECaixinha();
    }

    function atualizarDescECaixinha() {
      var resp     = AppData.getById(getResp());
      var cartao   = AppData.cartoes.find(function (c) { return c.id === getCartao(); });
      var respNome   = resp   ? resp.nome.split(' ')[0] : '';
      var cartaoNome = cartao ? cartao.nome             : '';

      var nomeInput = document.getElementById('sf-nova-nome');
      if (nomeInput.dataset.touched !== '1') nomeInput.value = cartaoNome;

      var descInput = document.getElementById('sf-desc');
      if (descInput.dataset.touched !== '1')
        descInput.value = 'Fatura ' + cartaoNome + (respNome ? ' · ' + respNome : '');
    }

    function atualizarVisNova() {
      document.getElementById('sf-nova-grupo').style.display =
        document.getElementById('sf-caixinha').value === 'nova' ? '' : 'none';
    }

    document.getElementById('sf-nova-nome').addEventListener('input', function () { this.dataset.touched = '1'; });
    document.getElementById('sf-desc').addEventListener('input',      function () { this.dataset.touched = '1'; });
    document.getElementById('sf-resp').addEventListener('change',    atualizarDRE);
    document.getElementById('sf-cartao').addEventListener('change',  atualizarDRE);
    document.getElementById('sf-caixinha').addEventListener('change', atualizarVisNova);

    atualizarDRE();
    atualizarVisNova();

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-sf-fechar').onclick   = fechar;
    document.getElementById('btn-sf-cancelar').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-sf-salvar').onclick = async function () {
      var valor = parseFloat(document.getElementById('sf-valor').value);
      var desc  = document.getElementById('sf-desc').value.trim();
      var data  = document.getElementById('sf-data').value.trim() || hoje();
      var cxSel = document.getElementById('sf-caixinha').value;

      if (!desc)                            { alert('Informe a descrição do lançamento.'); return; }
      if (isNaN(valor) || valor <= 0)       { alert('Informe um valor válido.');           return; }

      var btn = document.getElementById('btn-sf-salvar');
      btn.disabled     = true;
      btn.textContent  = 'Separando...';

      try {
        var caixinhaId;
        if (cxSel === 'nova') {
          var nomeCx = document.getElementById('sf-nova-nome').value.trim();
          if (!nomeCx) {
            alert('Informe o nome da nova caixinha.');
            btn.disabled    = false;
            btn.innerHTML   = '<i class="ph ph-piggy-bank" style="margin-right:5px"></i>Separar';
            return;
          }
          var novaCx = await AppData.addCaixinha({ nome: nomeCx, cor: CORES[0], meta: 0, responsavelId: null });
          caixinhaId = novaCx.id;
        } else {
          caixinhaId = parseInt(cxSel);
        }

        await AppData.addLancCaixinha(caixinhaId, { tipo: 'entrada', desc: desc, valor: valor, data: data });
        fechar();
        renderMain(true);
      } catch (err) {
        console.error('[sep-fatura] erro:', err);
        alert('Erro ao separar: ' + (err.message || JSON.stringify(err)));
        btn.disabled  = false;
        btn.innerHTML = '<i class="ph ph-piggy-bank" style="margin-right:5px"></i>Separar';
      }
    };
  }

  function abrirModalSepararTodos() {
    var ant = document.getElementById('modal-sep-todos');
    if (ant) ant.remove();

    var mesIdx  = AppState.mesIdx;
    var mesNome = MESES_NOME[mesIdx] + ' ' + AppState.ano;
    var admins  = AppData.getFluxoCaixa();
    var cartoes = AppData.cartoes;

    if (!admins.length)  { alert('Nenhum responsável cadastrado.');  return; }
    if (!cartoes.length) { alert('Nenhum cartão cadastrado.'); return; }

    var mesNum = String(mesIdx + 1).padStart(2, '0');
    var mesAno = String(AppState.ano);

    function jaFoiSeparado(cx, respPrimeiroNome) {
      if (!cx) return false;
      var nome = respPrimeiroNome.toLowerCase();
      return (cx.lancamentos || []).some(function (l) {
        if (l.tipo !== 'entrada' || !l.data) return false;
        var p = l.data.split('/');
        return p[1] === mesNum && p[2] === mesAno &&
               l.desc.toLowerCase().indexOf(nome) !== -1;
      });
    }

    // Monta apenas combinações com valor > 0 e que ainda não foram separadas
    var entradas = [];
    admins.forEach(function (resp) {
      cartoes.forEach(function (cartao) {
        var v = getDespCartaoRespValor(mesIdx, resp.id, cartao.id);
        if (v <= 0) return;
        var respNome = resp.nome.split(' ')[0];
        // Busca caixinha existente pelo nome do cartão (case-insensitive)
        var cx = AppData.caixinhas.find(function (c) {
          return c.nome.toLowerCase() === cartao.nome.toLowerCase();
        });
        // Pula se já foi separado este mês
        if (jaFoiSeparado(cx, respNome)) return;
        entradas.push({
          respNome:   respNome,
          cartaoNome: cartao.nome,
          valor:      v,
          cxId:       cx ? cx.id        : null,
          cxNome:     cx ? cx.nome       : cartao.nome,
          cxSaldo:    cx ? getSaldo(cx)  : null,
          isNova:     !cx,
          desc:       'Fatura ' + cartao.nome + ' · ' + respNome,
        });
      });
    });

    if (!entradas.length) {
      alert('Nenhum gasto encontrado na DRE para ' + mesNome + '.');
      return;
    }

    var linhasHTML = entradas.map(function (e, i) {
      var cxBadge = e.isNova
        ? '<span style="font-size:11px;background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;border-radius:12px;padding:2px 8px;font-weight:600">+ Nova: ' + e.cxNome + '</span>'
        : '<span style="font-size:11px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:12px;padding:2px 8px;font-weight:600" title="Saldo atual da caixinha">Existente: ' + e.cxNome + ' · ' + fmtR(e.cxSaldo) + '</span>';
      return '<tr>' +
        '<td style="padding:10px 8px 10px 12px"><input type="checkbox" class="sf-todos-chk" data-idx="' + i + '" checked style="width:15px;height:15px;accent-color:var(--color-primary)"></td>' +
        '<td style="font-size:13px;padding:10px 8px">' + e.respNome + '</td>' +
        '<td style="font-size:13px;font-weight:600;padding:10px 8px">' + e.cartaoNome + '</td>' +
        '<td style="font-size:13px;font-weight:700;color:#15803d;padding:10px 8px">' + fmtR(e.valor) + '</td>' +
        '<td style="padding:10px 8px">' + cxBadge + '</td>' +
      '</tr>';
    }).join('');

    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-sep-todos';
    m.innerHTML =
      '<div class="modal modal-wide">' +
        '<div class="modal-header">' +
          '<h3><i class="ph ph-stack" style="margin-right:6px"></i>Separar Todas as Faturas</h3>' +
          '<button class="modal-close" id="btn-st-fechar">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div style="display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#3b82f6;' +
               'border:1px solid #bfdbfe;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin-bottom:14px">' +
            '<i class="ph ph-calendar"></i>&nbsp;' + mesNome +
          '</div>' +
          '<p style="font-size:13px;color:var(--color-muted);margin:0 0 12px">' +
            'Valores calculados da DRE. Caixinhas com o mesmo nome do cartão serão reaproveitadas automaticamente.' +
          '</p>' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th style="width:36px"><input type="checkbox" id="sf-st-sel-all" checked style="width:15px;height:15px;accent-color:var(--color-primary)"></th>' +
              '<th>Responsável</th><th>Cartão</th><th>Valor DRE</th><th>Caixinha destino</th>' +
            '</tr></thead>' +
            '<tbody id="sf-st-body">' + linhasHTML + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="modal-footer" style="flex-direction:column;align-items:stretch;gap:12px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;' +
               'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px">' +
            '<span style="font-size:13px;color:#15803d;font-weight:600"><i class="ph ph-sigma" style="margin-right:4px"></i>Total selecionado</span>' +
            '<span id="sf-st-total" style="font-size:18px;font-weight:800;color:#15803d">' + fmtR(entradas.reduce(function(s,e){return s+e.valor;},0)) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end">' +
            '<button class="btn btn-outline" id="btn-st-cancelar">Cancelar</button>' +
            '<button class="btn btn-primary" id="btn-st-criar">' +
              '<i class="ph ph-stack" style="margin-right:5px"></i>Criar <span id="sf-st-count">' + entradas.length + '</span> lançamento(s)' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.classList.add('open');

    function atualizarContagem() {
      var total = 0;
      document.querySelectorAll('.sf-todos-chk:checked').forEach(function (cb) {
        total += entradas[parseInt(cb.dataset.idx)].valor;
      });
      document.getElementById('sf-st-count').textContent = document.querySelectorAll('.sf-todos-chk:checked').length;
      document.getElementById('sf-st-total').textContent = fmtR(total);
    }

    document.getElementById('sf-st-sel-all').addEventListener('change', function () {
      document.querySelectorAll('.sf-todos-chk').forEach(function (cb) { cb.checked = this.checked; }, this);
      atualizarContagem();
    });
    document.getElementById('sf-st-body').addEventListener('change', function (e) {
      if (!e.target.classList.contains('sf-todos-chk')) return;
      var all  = document.querySelectorAll('.sf-todos-chk');
      var chkd = document.querySelectorAll('.sf-todos-chk:checked');
      document.getElementById('sf-st-sel-all').checked = all.length > 0 && all.length === chkd.length;
      atualizarContagem();
    });

    function fechar() { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 300); }
    document.getElementById('btn-st-fechar').onclick   = fechar;
    document.getElementById('btn-st-cancelar').onclick = fechar;
    m.addEventListener('click', function (e) { if (e.target === m) fechar(); });

    document.getElementById('btn-st-criar').onclick = async function () {
      var selecionados = Array.from(document.querySelectorAll('.sf-todos-chk:checked'))
        .map(function (cb) { return entradas[parseInt(cb.dataset.idx)]; });
      if (!selecionados.length) { alert('Selecione ao menos uma fatura.'); return; }

      var btn = document.getElementById('btn-st-criar');
      btn.disabled    = true;
      btn.textContent = 'Criando...';

      var hoje_ = hoje();
      var cxCriadas = {};  // nome → id, para reaproveitar caixinhas novas criadas nesta operação

      try {
        for (var i = 0; i < selecionados.length; i++) {
          var e = selecionados[i];
          var caixinhaId = e.cxId;

          if (!caixinhaId) {
            if (cxCriadas[e.cartaoNome] !== undefined) {
              caixinhaId = cxCriadas[e.cartaoNome];
            } else {
              var novaCx = await AppData.addCaixinha({ nome: e.cartaoNome, cor: CORES[i % CORES.length], meta: 0, responsavelId: null });
              caixinhaId = novaCx.id;
              cxCriadas[e.cartaoNome] = caixinhaId;
            }
          }

          await AppData.addLancCaixinha(caixinhaId, { tipo: 'entrada', desc: e.desc, valor: e.valor, data: hoje_ });
        }
        fechar();
        renderMain(true);
      } catch (err) {
        console.error('[sep-todos] erro:', err);
        alert('Erro ao criar: ' + (err.message || JSON.stringify(err)));
        btn.disabled  = false;
        btn.innerHTML = '<i class="ph ph-stack" style="margin-right:5px"></i>Criar <span id="sf-st-count">' + selecionados.length + '</span> lançamento(s)';
      }
    };
  }

  // ── HTML builders ──

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
    var ocultas    = getOcultas();

    // Caixinhas visíveis e ocultas
    var todasOcultasLista = AppData.caixinhas.filter(function (c) { return ocultas.indexOf(c.id) !== -1; });
    var totalOcultas = todasOcultasLista.length;

    var GRUPO_CORES = ['#64748b', '#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706'];
    var grupos = [
      { respId: null, titulo: 'Reservas Gerais', icon: 'ph-globe-hemisphere-west', cor: GRUPO_CORES[0] }
    ].concat(admins.map(function (r, i) {
      return { respId: r.id, titulo: r.nome.split(' ')[0], icon: 'ph-user', cor: GRUPO_CORES[(i + 1) % GRUPO_CORES.length] };
    }));

    var gruposHTML = grupos.map(function (g) {
      var lista = AppData.caixinhas.filter(function (c) {
        var pertence = g.respId === null ? !c.responsavelId : c.responsavelId === g.respId;
        return pertence && ocultas.indexOf(c.id) === -1;
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

    var visiveis = AppData.caixinhas.filter(function (c) { return ocultas.indexOf(c.id) === -1; });
    var geralSub = visiveis.length + ' caixinha' + (visiveis.length !== 1 ? 's' : '') + ' · total acumulado';

    var btnOcultasHTML = totalOcultas > 0
      ? '<button class="btn btn-outline" id="btn-ver-ocultas" style="font-size:13px;display:flex;align-items:center;gap:6px">' +
          '<i class="ph ph-eye-slash"></i> Ver ocultadas' +
          '<span style="background:var(--color-muted);color:#fff;border-radius:20px;padding:1px 7px;font-size:11px;font-weight:700">' + totalOcultas + '</span>' +
        '</button>'
      : '';

    return '<div id="cx-view" class="cx-view-main">' +
      '<div class="page-header">' +
        '<h2>Caixinhas</h2>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          btnOcultasHTML +
          '<button class="btn btn-outline" id="btn-sep-fatura" style="color:var(--color-primary);border-color:var(--color-primary);font-size:13px;display:flex;align-items:center;gap:5px"><i class="ph ph-piggy-bank"></i>Separar Fatura</button>' +
          '<button class="btn btn-outline" id="btn-sep-todos" style="color:var(--color-primary);border-color:var(--color-primary);font-size:13px;display:flex;align-items:center;gap:5px"><i class="ph ph-stack"></i>Todos</button>' +
          '<button class="btn btn-primary" id="btn-nova-cx">+ Nova Caixinha</button>' +
        '</div>' +
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
    var saldo = getSaldo(c);

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
          var isTransf = l.tag === 'transferencia';

          // Badge do tipo
          var badgeHTML;
          if (isTransf) {
            badgeHTML = '<span class="badge" style="background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd">↔ Transferência</span>';
          } else if (ent) {
            badgeHTML = '<span class="badge" style="background:var(--color-income-bg);color:var(--color-income)">Entrada</span>';
          } else {
            badgeHTML = '<span class="badge" style="background:var(--color-expense-bg);color:var(--color-expense)">Saída</span>';
          }

          // Subtítulo de direção para transferências
          var subDesc = '';
          if (isTransf && l.paraCx) {
            subDesc = '<div style="font-size:11px;color:var(--color-muted);margin-top:1px">→ ' + l.paraCx + '</div>';
          } else if (isTransf && l.deCx) {
            subDesc = '<div style="font-size:11px;color:var(--color-muted);margin-top:1px">← ' + l.deCx + '</div>';
          }

          return '<tr>' +
            '<td style="color:var(--color-muted);font-size:13px">' + l.data + '</td>' +
            '<td><strong>' + l.desc + '</strong>' + subDesc + '</td>' +
            '<td>' + badgeHTML + '</td>' +
            '<td class="' + (ent ? 'amount-income' : 'amount-expense') + '">' + (ent ? '+' : '-') + fmtR(l.valor) + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn-edit-lanc-cx" data-id="' + l.id + '" style="background:none;border:none;color:#3b82f6;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:15px;line-height:1" title="Editar"><i class="ph ph-pencil"></i></button>' +
              '<button class="btn-del-lanc-cx" data-id="' + l.id + '" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:18px;line-height:1" title="Remover">×</button>' +
            '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--color-muted);padding:36px 22px">' + emptyMsg + '</td></tr>';

    var ocultaBtnHTML = isOculta(c.id)
      ? '<button id="btn-mostrar-cx" style="background:#f0fdf4;color:#16a34a;border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600"><i class="ph ph-eye" style="margin-right:4px"></i>Mostrar</button>'
      : '<button id="btn-ocultar-cx" style="background:var(--color-bg-alt,#f8fafc);color:var(--color-muted);border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600"><i class="ph ph-eye-slash" style="margin-right:4px"></i>Ocultar</button>';

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
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
          '<button id="btn-add-lanc-cx" class="cx-btn-ghost"><i class="ph ph-plus"></i> Lançamento</button>' +
          '<button id="btn-transferir-cx" class="cx-btn-ghost" style="font-size:13px"><i class="ph ph-arrows-left-right"></i> Transferir</button>' +
        '</div>' +
      '</div>' +

      '<div class="section-box" style="margin-top:18px">' +
        '<div class="section-box-header">' +
          '<h2>Lançamentos &nbsp;' + filtroTag + '</h2>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button id="btn-transferir-cx2" style="background:#f0f9ff;color:#0284c7;border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600"><i class="ph ph-arrows-left-right" style="margin-right:4px"></i>Transferir</button>' +
            '<button id="btn-editar-cx" style="background:var(--color-primary-light);color:var(--color-primary);border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600"><i class="ph ph-pencil" style="margin-right:4px"></i>Editar</button>' +
            ocultaBtnHTML +
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
    document.getElementById('btn-sep-fatura').addEventListener('click', abrirModalSepararFatura);
    document.getElementById('btn-sep-todos').addEventListener('click', abrirModalSepararTodos);

    var btnOcultas = document.getElementById('btn-ver-ocultas');
    if (btnOcultas) btnOcultas.addEventListener('click', abrirModalOcultas);

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

    // Botão Transferir no header
    var btnTransfHdr = document.getElementById('btn-transferir-cx');
    if (btnTransfHdr) btnTransfHdr.addEventListener('click', function () { abrirModalTransferencia(c); });

    // Botão Transferir na tabela
    var btnTransf2 = document.getElementById('btn-transferir-cx2');
    if (btnTransf2) btnTransf2.addEventListener('click', function () { abrirModalTransferencia(c); });

    // Botão Ocultar
    var btnOcultar = document.getElementById('btn-ocultar-cx');
    if (btnOcultar) {
      btnOcultar.addEventListener('click', function () {
        ocultarCaixinha(c.id);
        voltarParaMain();
      });
    }

    // Botão Mostrar (quando já está oculta)
    var btnMostrar = document.getElementById('btn-mostrar-cx');
    if (btnMostrar) {
      btnMostrar.addEventListener('click', function () {
        mostrarCaixinhaId(c.id);
        renderDetalhe(c, false);
      });
    }

    document.getElementById('btn-excluir-cx').addEventListener('click', async function () {
      if (!confirm('Excluir a caixinha "' + c.nome + '"?\nTodos os lançamentos serão perdidos.')) return;
      await AppData.removeCaixinha(c.id);
      caixinhaAtiva = null;
      voltarParaMain();
    });

    var tbody = document.querySelector('#cx-view tbody');
    if (tbody) {
      tbody.addEventListener('click', async function (e) {
        var btnEdit = e.target.closest('.btn-edit-lanc-cx');
        if (btnEdit) {
          var lancId = parseInt(btnEdit.dataset.id);
          var lanc = (c.lancamentos || []).find(function (x) { return x.id === lancId; });
          if (lanc) abrirModalEditarLanc(lanc);
          return;
        }
        var btnDel = e.target.closest('.btn-del-lanc-cx');
        if (!btnDel) return;
        if (!confirm('Remover este lançamento?')) return;
        await AppData.removeLancCaixinha(c.id, parseInt(btnDel.dataset.id));
        var freshC = AppData.caixinhas.find(function (x) { return x.id === c.id; });
        if (freshC) { caixinhaAtiva = freshC; renderDetalhe(freshC, false); }
      });
    }
  }

  // ── Init ──
  renderMain(false);
});
