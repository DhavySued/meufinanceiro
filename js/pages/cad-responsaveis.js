Router.register('cad-responsaveis', function (container) {

  function inicialAvatar(nome) {
    return nome.split(' ').slice(0, 2).map(function (n) { return n[0]; }).join('').toUpperCase();
  }

  function badgePerfil(perfil) {
    return perfil === 'Administrador'
      ? '<span class="badge" style="background:var(--color-primary-light);color:var(--color-primary)">Administrador</span>'
      : '<span class="badge" style="background:#f3f4f6;color:var(--color-muted)">Terceiro</span>';
  }

  function buildRow(r) {
    var fluxoBadge = r.fluxoCaixa
      ? '<span class="badge badge-income">Sim</span>'
      : '<span class="badge" style="background:#f3f4f6;color:var(--color-muted)">Não</span>';
    var ganhosInfo = r.fluxoCaixa && r.ganhos && r.ganhos.length
      ? '<span style="font-size:12px;color:var(--color-muted)">' + r.ganhos.length + ' ganho(s) fixo(s)</span>'
      : '';
    return '<tr data-id="' + r.id + '">' +
      '<td><div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);color:#fff;' +
          'display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">' +
          inicialAvatar(r.nome) +
        '</div><div><strong>' + r.nome + '</strong><br>' + ganhosInfo + '</div>' +
      '</div></td>' +
      '<td style="color:var(--color-muted)">' + r.email + '</td>' +
      '<td>' + badgePerfil(r.perfil) + '</td>' +
      '<td>' + fluxoBadge + '</td>' +
      '<td><span class="badge badge-income">Ativo</span></td>' +
      '<td style="display:flex;gap:6px;padding:10px 22px">' +
        '<button class="btn btn-outline btn-editar-resp" data-id="' + r.id + '" style="font-size:12px;padding:5px 12px">Editar</button>' +
        '<button class="btn btn-excluir-resp" data-id="' + r.id + '" style="font-size:12px;padding:5px 12px;background:var(--color-expense-bg);color:var(--color-expense);border-radius:8px;font-weight:600">Excluir</button>' +
      '</td>' +
    '</tr>';
  }

  container.innerHTML =
    '<div class="page-header">' +
      '<h2>Responsáveis</h2>' +
      '<button class="btn btn-primary" id="btn-novo-resp">+ Novo Responsável</button>' +
    '</div>' +
    '<div class="section-box">' +
      '<table class="data-table">' +
        '<thead><tr>' +
          '<th>Nome</th><th>E-mail</th><th>Perfil</th><th>Fluxo de Caixa</th><th>Status</th><th>Ações</th>' +
        '</tr></thead>' +
        '<tbody id="tbody-responsaveis">' +
          AppData.responsaveis.map(buildRow).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';

  // ── Modal ──
  var anterior = document.getElementById('modal-resp');
  if (anterior) anterior.remove();

  var optsCat = AppData.categorias.map(function (c) {
    return '<option value="' + c.nome + '">' + c.nome + '</option>';
  }).join('');

  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-resp';
  modal.innerHTML =
    '<div class="modal modal-wide">' +
      '<div class="modal-header">' +
        '<h3 id="resp-modal-titulo">Novo Responsável</h3>' +
        '<button class="modal-close" id="btn-fechar-resp">&times;</button>' +
      '</div>' +
      '<div class="modal-body" style="max-height:72vh;overflow-y:auto">' +

        // ── Dados básicos ──
        '<div class="form-group">' +
          '<label>Nome Completo</label>' +
          '<input type="text" id="resp-nome" placeholder="Ex: João Silva" />' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>E-mail</label>' +
            '<input type="email" id="resp-email" placeholder="Ex: joao@email.com" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Perfil</label>' +
            '<select id="resp-perfil">' +
              '<option>Administrador</option><option>Terceiro</option>' +
            '</select>' +
          '</div>' +
        '</div>' +

        // ── Fluxo de caixa + Ganhos ──
        '<div class="form-section">' +
          '<label class="form-section-toggle">' +
            '<input type="checkbox" id="resp-fluxo" />' +
            '💰 Responsável de Fluxo de Caixa' +
          '</label>' +
          '<div class="form-section-body" id="resp-fluxo-body">' +
            '<p style="font-size:13px;color:var(--color-muted);margin:0">' +
              'Este responsável terá um fluxo de caixa próprio no Mês a Mês.' +
            '</p>' +
            '<div class="form-section-subtitle">Ganhos Mensais Fixos</div>' +
            '<div class="ganhos-list" id="ganhos-list"></div>' +
            '<button class="btn-add-ganho" id="btn-add-ganho">+ Adicionar Ganho</button>' +
          '</div>' +
        '</div>' +

        // ── Despesas Fixas Sugeridas ──
        '<div class="form-section">' +
          '<label class="form-section-toggle">' +
            '<input type="checkbox" id="resp-toggle-fixas" />' +
            '📌 Despesas Fixas Sugeridas' +
          '</label>' +
          '<div class="form-section-body" id="resp-fixas-body">' +
            '<p style="font-size:13px;color:var(--color-muted);margin:0 0 10px">' +
              'Despesas que aparecem automaticamente na DRE todo mês. Podem ser editadas ou excluídas da lista abaixo.' +
            '</p>' +
            '<div id="fixas-list"></div>' +
            '<button class="btn-add-ganho" id="btn-add-fixa">+ Adicionar Despesa Fixa</button>' +
          '</div>' +
        '</div>' +

        // ── Orçamentos Sugeridos ──
        '<div class="form-section">' +
          '<label class="form-section-toggle">' +
            '<input type="checkbox" id="resp-toggle-orc" />' +
            '🎯 Orçamentos Sugeridos' +
          '</label>' +
          '<div class="form-section-body" id="resp-orc-body">' +
            '<p style="font-size:13px;color:var(--color-muted);margin:0 0 10px">' +
              'Limites mensais por categoria provisionados automaticamente na DRE. O saldo restante entra no total de despesas.' +
            '</p>' +
            '<div id="orc-list"></div>' +
            '<button class="btn-add-ganho" id="btn-add-orc">+ Adicionar Orçamento</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="btn-cancelar-resp">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-resp">Salvar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // ── Listas em memória ──
  var ganhosList      = [];
  var despesasFixas   = [];
  var orcamentos      = [];

  // ── Render: Ganhos ──
  function renderGanhos() {
    var lista = document.getElementById('ganhos-list');
    if (!lista) return;
    lista.innerHTML = ganhosList.map(function (g, i) {
      return '<div class="ganho-item">' +
        '<input class="ganho-desc" type="text" placeholder="Descrição (Ex: Salário)" value="' + (g.desc || '') + '" />' +
        '<input class="ganho-valor" type="number" placeholder="Valor R$" min="0" step="0.01" value="' + (g.valor || '') + '" />' +
        '<input class="ganho-dia" type="number" placeholder="Dia" min="1" max="31" value="' + (g.dia || '') + '" title="Dia do mês que recebe" style="width:70px" />' +
        '<input class="ganho-ate" type="month" value="' + (g.ate || '') + '" title="Válido até (mês/ano)" style="width:140px;padding:8px;border:1px solid var(--color-border);border-radius:8px;font-size:13px" />' +
        '<button class="ganho-del" data-del="' + i + '" title="Remover">&times;</button>' +
      '</div>';
    }).join('');
    lista.querySelectorAll('.ganho-desc').forEach(function (inp, i) {
      inp.addEventListener('input', function () { ganhosList[i].desc = inp.value; });
    });
    lista.querySelectorAll('.ganho-valor').forEach(function (inp, i) {
      inp.addEventListener('input', function () { ganhosList[i].valor = parseFloat(inp.value) || 0; });
    });
    lista.querySelectorAll('.ganho-dia').forEach(function (inp, i) {
      inp.addEventListener('input', function () { ganhosList[i].dia = parseInt(inp.value) || 1; });
    });
    lista.querySelectorAll('.ganho-ate').forEach(function (inp, i) {
      inp.addEventListener('input', function () { ganhosList[i].ate = inp.value || ''; });
    });
    lista.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ganhosList.splice(parseInt(btn.dataset.del), 1);
        renderGanhos();
      });
    });
  }

  // ── Render: Despesas Fixas ──
  function renderFixas() {
    var lista = document.getElementById('fixas-list');
    if (!lista) return;
    lista.innerHTML = despesasFixas.map(function (d, i) {
      return '<div class="ganho-item">' +
        '<input class="fixa-desc" type="text" placeholder="Ex: Conta de Luz" value="' + (d.desc || '') + '" style="flex:2" />' +
        '<input class="fixa-valor" type="number" placeholder="R$" min="0" step="0.01" value="' + (d.valor || '') + '" />' +
        '<select class="fixa-qz" style="padding:8px;border:1px solid var(--color-border);border-radius:8px;font-size:13px">' +
          '<option value="1"' + (d.quinzena === 1 ? ' selected' : '') + '>1ª Quinzena</option>' +
          '<option value="2"' + (d.quinzena !== 1 ? ' selected' : '') + '>2ª Quinzena</option>' +
        '</select>' +
        '<input class="fixa-ate" type="month" value="' + (d.ate || '') + '" title="Válido até (mês/ano)" style="width:140px;padding:8px;border:1px solid var(--color-border);border-radius:8px;font-size:13px" />' +
        '<button class="ganho-del" data-del-fixa="' + i + '" title="Remover">&times;</button>' +
      '</div>';
    }).join('');
    lista.querySelectorAll('.fixa-desc').forEach(function (inp, i) {
      inp.addEventListener('input', function () { despesasFixas[i].desc = inp.value; });
    });
    lista.querySelectorAll('.fixa-valor').forEach(function (inp, i) {
      inp.addEventListener('input', function () { despesasFixas[i].valor = parseFloat(inp.value) || 0; });
    });
    lista.querySelectorAll('.fixa-qz').forEach(function (sel, i) {
      sel.addEventListener('change', function () { despesasFixas[i].quinzena = parseInt(sel.value); });
    });
    lista.querySelectorAll('.fixa-ate').forEach(function (inp, i) {
      inp.addEventListener('input', function () { despesasFixas[i].ate = inp.value || ''; });
    });
    lista.querySelectorAll('[data-del-fixa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        despesasFixas.splice(parseInt(btn.dataset.delFixa), 1);
        renderFixas();
      });
    });
  }

  // ── Render: Orçamentos ──
  function renderOrcamentos() {
    var lista = document.getElementById('orc-list');
    if (!lista) return;
    lista.innerHTML = orcamentos.map(function (o, i) {
      return '<div class="ganho-item">' +
        '<select class="orc-cat" style="flex:2;padding:8px;border:1px solid var(--color-border);border-radius:8px;font-size:13px">' +
          optsCat.replace('value="' + o.catNome + '"', 'value="' + o.catNome + '" selected') +
        '</select>' +
        '<input class="orc-limite" type="number" placeholder="Limite R$" min="1" step="0.01" value="' + (o.limite || '') + '" />' +
        '<button class="ganho-del" data-del-orc="' + i + '" title="Remover">&times;</button>' +
      '</div>';
    }).join('');
    lista.querySelectorAll('.orc-cat').forEach(function (sel, i) {
      sel.addEventListener('change', function () { orcamentos[i].catNome = sel.value; });
    });
    lista.querySelectorAll('.orc-limite').forEach(function (inp, i) {
      inp.addEventListener('input', function () { orcamentos[i].limite = parseFloat(inp.value) || 0; });
    });
    lista.querySelectorAll('[data-del-orc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        orcamentos.splice(parseInt(btn.dataset.delOrc), 1);
        renderOrcamentos();
      });
    });
  }

  // ── Toggles das seções ──
  document.getElementById('resp-fluxo').addEventListener('change', function () {
    document.getElementById('resp-fluxo-body').classList.toggle('visible', this.checked);
  });
  document.getElementById('resp-toggle-fixas').addEventListener('change', function () {
    document.getElementById('resp-fixas-body').classList.toggle('visible', this.checked);
  });
  document.getElementById('resp-toggle-orc').addEventListener('change', function () {
    document.getElementById('resp-orc-body').classList.toggle('visible', this.checked);
  });

  // ── Botões de adicionar ──
  document.getElementById('btn-add-ganho').addEventListener('click', function () {
    ganhosList.push({ desc: '', valor: 0, dia: 5 });
    renderGanhos();
  });
  document.getElementById('btn-add-fixa').addEventListener('click', function () {
    despesasFixas.push({ desc: '', valor: 0, quinzena: 2 });
    renderFixas();
  });
  document.getElementById('btn-add-orc').addEventListener('click', function () {
    orcamentos.push({ catNome: AppData.categorias[0] ? AppData.categorias[0].nome : '', limite: 0 });
    renderOrcamentos();
  });

  // ── Abrir / fechar ──
  var editandoId = null;

  function preencherModal(r) {
    var editando = !!r;
    document.getElementById('resp-modal-titulo').textContent = editando ? 'Editar Responsável' : 'Novo Responsável';
    document.getElementById('resp-nome').value   = editando ? r.nome   : '';
    document.getElementById('resp-email').value  = editando ? r.email  : '';
    document.getElementById('resp-perfil').value = editando ? r.perfil : 'Administrador';

    // Ganhos / fluxo
    var temFluxo = editando && r.fluxoCaixa;
    document.getElementById('resp-fluxo').checked = temFluxo;
    document.getElementById('resp-fluxo-body').classList.toggle('visible', temFluxo);
    ganhosList = editando && r.ganhos ? r.ganhos.map(function (g) { return Object.assign({}, g); }) : [];
    renderGanhos();

    // Despesas Fixas
    var temFixas = editando && r.despesasFixas && r.despesasFixas.length;
    document.getElementById('resp-toggle-fixas').checked = !!temFixas;
    document.getElementById('resp-fixas-body').classList.toggle('visible', !!temFixas);
    despesasFixas = editando && r.despesasFixas ? r.despesasFixas.map(function (d) { return Object.assign({}, d); }) : [];
    renderFixas();

    // Orçamentos
    var temOrc = editando && r.orcamentos && r.orcamentos.length;
    document.getElementById('resp-toggle-orc').checked = !!temOrc;
    document.getElementById('resp-orc-body').classList.toggle('visible', !!temOrc);
    orcamentos = editando && r.orcamentos ? r.orcamentos.map(function (o) { return Object.assign({}, o); }) : [];
    renderOrcamentos();
  }

  function abrirNovo() { editandoId = null; preencherModal(null); modal.classList.add('open'); }
  function abrirEditar(resp) { editandoId = resp.id; preencherModal(resp); modal.classList.add('open'); }
  function fechar() { modal.classList.remove('open'); }

  document.getElementById('btn-novo-resp').addEventListener('click', abrirNovo);
  document.getElementById('btn-fechar-resp').addEventListener('click', fechar);
  document.getElementById('btn-cancelar-resp').addEventListener('click', fechar);
  modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

  document.getElementById('tbody-responsaveis').addEventListener('click', async function (e) {
    var btnEditar  = e.target.closest('.btn-editar-resp');
    var btnExcluir = e.target.closest('.btn-excluir-resp');
    if (btnEditar) {
      var id = parseInt(btnEditar.dataset.id);
      var resp = AppData.responsaveis.find(function (r) { return r.id === id; });
      if (resp) abrirEditar(resp);
    }
    if (btnExcluir) {
      var id = parseInt(btnExcluir.dataset.id);
      var resp = AppData.responsaveis.find(function (r) { return r.id === id; });
      if (!resp) return;
      if (!confirm('Excluir o responsável "' + resp.nome + '"?\nEsta ação não pode ser desfeita.')) return;
      await AppData.removeResponsavel(id);
      var tr = document.querySelector('#tbody-responsaveis tr[data-id="' + id + '"]');
      if (tr) tr.remove();
    }
  });

  // ── Salvar ──
  document.getElementById('btn-salvar-resp').addEventListener('click', async function () {
    var nome   = document.getElementById('resp-nome').value.trim();
    var email  = document.getElementById('resp-email').value.trim();
    var perfil = document.getElementById('resp-perfil').value;
    var fluxo  = document.getElementById('resp-fluxo').checked;
    var ganhos = fluxo ? ganhosList.filter(function (g) { return g.desc && g.desc.trim(); }) : [];
    var fixas  = despesasFixas.filter(function (d) { return d.desc && d.desc.trim() && d.valor > 0; });
    var orcs   = orcamentos.filter(function (o) { return o.catNome && o.limite > 0; });

    if (!nome || !email) { alert('Preencha o nome e o e-mail.'); return; }

    var tbody = document.getElementById('tbody-responsaveis');

    try {
      if (editandoId !== null) {
        var atualizado = await AppData.updateResponsavel(editandoId, {
          nome: nome, email: email, perfil: perfil, fluxoCaixa: fluxo,
          ganhos: ganhos, despesasFixas: fixas, orcamentos: orcs
        });
        var tr = tbody.querySelector('tr[data-id="' + editandoId + '"]');
        if (tr) tr.outerHTML = buildRow(atualizado);
      } else {
        var novo = await AppData.addResponsavel({
          nome: nome, email: email, perfil: perfil, fluxoCaixa: fluxo,
          ganhos: ganhos, despesasFixas: fixas, orcamentos: orcs
        });
        tbody.insertAdjacentHTML('afterbegin', buildRow(novo));
      }
      fechar();
    } catch (err) {
      console.error('Erro ao salvar responsável:', err);
      alert('Erro ao salvar responsável. Verifique o console (F12) para detalhes.');
    }
  });
});
