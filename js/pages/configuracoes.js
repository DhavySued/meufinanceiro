Router.register('configuracoes', function (container) {

  var CFG_CX_FILTRO_MES = 'mf_cx_filtro_mes';

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
    '</div>';

  // ── Estado inicial ──
  var chk = document.getElementById('cfg-cx-filtro-mes');
  chk.checked = localStorage.getItem(CFG_CX_FILTRO_MES) === 'true';

  chk.addEventListener('change', function () {
    localStorage.setItem(CFG_CX_FILTRO_MES, this.checked ? 'true' : 'false');
    // Feedback visual imediato na linha
    document.getElementById('lbl-cx-filtro-mes').classList.toggle('cfg-toggle-row-ativa', this.checked);
  });

  // Destaca a linha se já estiver ativa
  if (chk.checked) {
    document.getElementById('lbl-cx-filtro-mes').classList.add('cfg-toggle-row-ativa');
  }
});
