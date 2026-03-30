Router.register('orcamento', function (container) {

  var MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var mesAtualIdx = AppState.mesIdx;

  function fmtR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Soma de lançamentos de uma categoria no mês selecionado
  function gastoCategoriaMes(catNome, mesIdx) {
    var mesNum = String(mesIdx + 1).padStart(2, '0');
    return AppData.getLancamentos()
      .filter(function (l) {
        return l.cat === catNome && l.data.split('/')[1] === mesNum;
      })
      .reduce(function (s, l) { return s + l.valor; }, 0);
  }

  // ── Modal ──
  var antModal = document.getElementById('modal-meta');
  if (antModal) antModal.remove();

  var editandoId = null;
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-meta';
  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<h3 id="meta-titulo">Nova Meta</h3>' +
        '<button class="modal-close" id="btn-fechar-meta">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label>Categoria</label>' +
          '<select id="meta-cat">' +
            AppData.categorias.map(function (c) {
              return '<option value="' + c.nome + '">' + c.nome + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Limite Mensal (R$)</label>' +
          '<input type="number" id="meta-valor" placeholder="Ex: 700" min="1" step="0.01" />' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="btn-cancelar-meta">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-meta">Salvar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  function fechar() { modal.classList.remove('open'); }

  function abrirNovo() {
    editandoId = null;
    document.getElementById('meta-titulo').textContent = 'Nova Meta';
    document.getElementById('meta-cat').selectedIndex  = 0;
    document.getElementById('meta-valor').value        = '';
    modal.classList.add('open');
  }

  function abrirEditar(m) {
    editandoId = m.id;
    document.getElementById('meta-titulo').textContent = 'Editar Meta';
    document.getElementById('meta-cat').value          = m.catNome;
    document.getElementById('meta-valor').value        = m.limite;
    modal.classList.add('open');
  }

  document.getElementById('btn-fechar-meta').addEventListener('click', fechar);
  document.getElementById('btn-cancelar-meta').addEventListener('click', fechar);
  modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

  document.getElementById('btn-salvar-meta').addEventListener('click', async function () {
    var catNome = document.getElementById('meta-cat').value;
    var limite  = parseFloat(document.getElementById('meta-valor').value);
    if (!catNome || isNaN(limite) || limite <= 0) {
      alert('Selecione uma categoria e informe o limite.');
      return;
    }
    if (editandoId !== null) {
      await AppData.updateMeta(editandoId, { catNome: catNome, limite: limite });
    } else {
      await AppData.addMeta({ catNome: catNome, limite: limite });
    }
    fechar();
    render();
  });

  // ── Render ──
  function render() {
    var metas   = AppData.getMetas();
    var mesNome = MESES_NOMES[mesAtualIdx];

    var cardsHTML = metas.length
      ? metas.map(function (m) {
          var gasto     = gastoCategoriaMes(m.catNome, mesAtualIdx);
          var restante  = m.limite - gasto;
          var pct       = m.limite > 0 ? Math.min(Math.round((gasto / m.limite) * 100), 100) : 0;
          var excedeu   = gasto > m.limite;

          var corBarra  = pct < 70 ? '#22c55e' : pct < 90 ? '#f59e0b' : '#ef4444';
          var corCard   = excedeu ? '#fff5f5' : '#fff';
          var corBorda  = excedeu ? '#fecaca' : 'var(--color-border)';

          // Busca cor da categoria cadastrada
          var catObj = AppData.categorias.find(function (c) { return c.nome === m.catNome; });
          var corCat = catObj ? catObj.cor : '#6366f1';

          return '<div style="background:' + corCard + ';border:1px solid ' + corBorda + ';border-radius:14px;padding:20px 22px;display:flex;flex-direction:column;gap:10px">' +

            // Header
            '<div style="display:flex;align-items:center;justify-content:space-between">' +
              '<div style="display:flex;align-items:center;gap:10px">' +
                '<div style="width:12px;height:12px;border-radius:50%;background:' + corCat + ';flex-shrink:0"></div>' +
                '<span style="font-weight:700;font-size:15px">' + m.catNome + '</span>' +
              '</div>' +
              '<div style="display:flex;gap:6px">' +
                '<button class="btn btn-outline btn-editar-meta" data-id="' + m.id + '" style="font-size:12px;padding:4px 10px">Editar</button>' +
                '<button class="btn btn-excluir-meta" data-id="' + m.id + '" style="font-size:12px;padding:4px 10px;background:var(--color-expense-bg);color:var(--color-expense);border-radius:8px;font-weight:600">Excluir</button>' +
              '</div>' +
            '</div>' +

            // Valores
            '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
              '<div>' +
                '<div style="font-size:22px;font-weight:800;color:' + (excedeu ? '#ef4444' : '#1a1d2e') + '">' + fmtR(gasto) + '</div>' +
                '<div style="font-size:12px;color:var(--color-muted);margin-top:1px">gasto de ' + fmtR(m.limite) + '</div>' +
              '</div>' +
              '<div style="text-align:right">' +
                (excedeu
                  ? '<div style="font-size:13px;font-weight:700;color:#ef4444">⚠ Excedeu ' + fmtR(Math.abs(restante)) + '</div>'
                  : '<div style="font-size:13px;font-weight:700;color:#22c55e">Resta ' + fmtR(restante) + '</div>') +
                '<div style="font-size:12px;color:var(--color-muted)">' + pct + '% utilizado</div>' +
              '</div>' +
            '</div>' +

            // Barra de progresso
            '<div style="height:8px;border-radius:6px;background:#f1f5f9;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + corBarra + ';border-radius:6px;transition:width .4s ease"></div>' +
            '</div>' +

          '</div>';
        }).join('')
      : '<div class="section-box" style="padding:48px;text-align:center;color:var(--color-muted)">' +
          '<div style="font-size:40px;margin-bottom:12px">🎯</div>' +
          '<p style="font-size:15px">Nenhuma meta cadastrada.</p>' +
          '<p style="font-size:13px;margin-top:6px">Defina um limite por categoria para acompanhar seus gastos.</p>' +
        '</div>';

    container.innerHTML =
      '<div class="page-header">' +
        '<h2>Orçamento</h2>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<select id="orc-mes" style="padding:7px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface)">' +
            MESES_NOMES.map(function (m, i) {
              return '<option value="' + i + '"' + (i === mesAtualIdx ? ' selected' : '') + '>' + m + ' 2026</option>';
            }).join('') +
          '</select>' +
          '<button class="btn btn-primary" id="btn-nova-meta">+ Nova Meta</button>' +
        '</div>' +
      '</div>' +

      (metas.length
        ? '<p style="font-size:13px;color:var(--color-muted);margin:-8px 0 18px">' +
            mesNome + ' · ' + metas.length + ' meta(s) definida(s)' +
          '</p>'
        : '') +

      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">' +
        cardsHTML +
      '</div>';

    document.getElementById('orc-mes').addEventListener('change', function () {
      mesAtualIdx = parseInt(this.value);
      AppState.set(mesAtualIdx, AppState.ano);
      render();
    });

    document.getElementById('btn-nova-meta').addEventListener('click', abrirNovo);

    container.addEventListener('click', async function (e) {
      var btnEditar  = e.target.closest('.btn-editar-meta');
      var btnExcluir = e.target.closest('.btn-excluir-meta');

      if (btnEditar) {
        var id   = parseInt(btnEditar.dataset.id);
        var meta = AppData.getMetas().find(function (m) { return m.id === id; });
        if (meta) abrirEditar(meta);
      }

      if (btnExcluir) {
        var id   = parseInt(btnExcluir.dataset.id);
        var meta = AppData.getMetas().find(function (m) { return m.id === id; });
        if (!meta) return;
        if (!confirm('Excluir meta de "' + meta.catNome + '"?')) return;
        await AppData.removeMeta(id);
        render();
      }
    });
  }

  render();
});
