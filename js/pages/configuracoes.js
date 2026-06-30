Router.register('configuracoes', function (container) {

  var CFG_CX_FILTRO_MES = 'mf_cx_filtro_mes';

  var MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  container.innerHTML =
    '<div class="page-header"><h2>Configurações</h2></div>' +

    // ── Subgrupo: Visualização das Caixinhas ──
    '<div class="section-box" style="max-width:640px">' +
      '<div class="section-box-header">' +
        '<h2><i class="ph ph-piggy-bank" style="margin-right:8px;opacity:0.6"></i>Visualização das Caixinhas</h2>' +
      '</div>' +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:20px">' +

        '<label class="cfg-toggle-row" id="lbl-cx-filtro-mes">' +
          '<div class="cfg-toggle-info">' +
            '<div class="cfg-toggle-title">Exibir histórico apenas do mês atual</div>' +
            '<div class="cfg-toggle-desc">' +
              'Quando ativo, o histórico de lançamentos dentro de cada caixinha mostra apenas ' +
              'o mês/ano selecionado no topo do app. O saldo total permanece o acumulado de todos os tempos.' +
            '</div>' +
          '</div>' +
          '<div class="cfg-toggle-switch">' +
            '<input type="checkbox" id="cfg-cx-filtro-mes" />' +
            '<span class="cfg-toggle-track"></span>' +
          '</div>' +
        '</label>' +

      '</div>' +
    '</div>' +

    // ── Subgrupo: Competências Encerradas ──
    '<div class="section-box" style="max-width:640px;margin-top:24px" id="box-competencias-enc">' +
      '<div class="section-box-header">' +
        '<h2><i class="ph ph-lock-simple" style="margin-right:8px;opacity:0.6"></i>Competências Encerradas</h2>' +
      '</div>' +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px">' +
        '<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">' +
          'Meses encerrados não permitem nenhuma inclusão, edição ou exclusão de lançamentos — ' +
          'nem mesmo operações automáticas do sistema.' +
        '</p>' +
        '<div style="display:flex;gap:10px;align-items:center">' +
          '<select id="cfg-enc-sel" style="flex:1;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px"></select>' +
          '<button id="cfg-enc-btn" style="padding:9px 18px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap">' +
            '<i class="ph-bold ph-lock-simple" style="margin-right:6px"></i>Encerrar' +
          '</button>' +
        '</div>' +
        '<ul id="cfg-enc-lista" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px"></ul>' +
      '</div>' +
    '</div>';

  // ── Estado inicial ── caixinhas toggle
  var chk = document.getElementById('cfg-cx-filtro-mes');
  chk.checked = localStorage.getItem(CFG_CX_FILTRO_MES) === 'true';

  chk.addEventListener('change', function () {
    localStorage.setItem(CFG_CX_FILTRO_MES, this.checked ? 'true' : 'false');
    document.getElementById('lbl-cx-filtro-mes').classList.toggle('cfg-toggle-row-ativa', this.checked);
  });

  if (chk.checked) {
    document.getElementById('lbl-cx-filtro-mes').classList.add('cfg-toggle-row-ativa');
  }

  // ── Competências Encerradas ──────────────────────────────
  var sel   = document.getElementById('cfg-enc-sel');
  var lista = document.getElementById('cfg-enc-lista');

  function nomeMes(mesRef) {
    var p = mesRef.split('-');
    return MESES_NOME[parseInt(p[1]) - 1] + ' ' + p[0];
  }

  function popularSelect() {
    var encerradas = AppData.getCompetenciasEncerradas();
    sel.innerHTML = '';
    var hoje = new Date();
    for (var i = -36; i <= 2; i++) {
      var d  = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var mr = d.getFullYear() + '-' + mm;
      if (encerradas.indexOf(mr) !== -1) continue; // já encerrado, não mostra no select
      var opt = document.createElement('option');
      opt.value = mr;
      opt.textContent = nomeMes(mr);
      sel.appendChild(opt);
    }
  }

  function renderLista() {
    var encerradas = AppData.getCompetenciasEncerradas().slice().sort().reverse();
    lista.innerHTML = '';
    if (!encerradas.length) {
      lista.innerHTML = '<li style="font-size:13px;color:#9ca3af;text-align:center;padding:8px 0">Nenhuma competência encerrada.</li>';
      return;
    }
    encerradas.forEach(function (mr) {
      var li = document.createElement('li');
      li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
        'padding:10px 14px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px';
      li.innerHTML =
        '<span style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#92400e">' +
          '<i class="ph-bold ph-lock-simple"></i>' + nomeMes(mr) +
        '</span>' +
        '<button data-mr="' + mr + '" class="btn-reabrir-enc" ' +
          'style="padding:6px 14px;background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:pointer">' +
          'Reabrir' +
        '</button>';
      lista.appendChild(li);
    });

    lista.querySelectorAll('.btn-reabrir-enc').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var mr = this.dataset.mr;
        if (!confirm('Reabrir a competência ' + nomeMes(mr) + '? Lançamentos poderão ser alterados novamente.')) return;
        try {
          await AppData.reabrirCompetencia(mr);
          popularSelect();
          renderLista();
          atualizarIndicadorEncerrado();
        } catch (e) {
          alert('Erro ao reabrir: ' + (e.message || e));
        }
      });
    });
  }

  document.getElementById('cfg-enc-btn').addEventListener('click', async function () {
    var mr = sel.value;
    if (!mr) return;
    if (!confirm('Encerrar a competência ' + nomeMes(mr) + '? Nenhum lançamento poderá ser alterado neste mês.')) return;
    try {
      await AppData.encerrarCompetencia(mr);
      popularSelect();
      renderLista();
      atualizarIndicadorEncerrado();
    } catch (e) {
      alert('Erro ao encerrar: ' + (e.message || e));
    }
  });

  popularSelect();
  renderLista();
});
