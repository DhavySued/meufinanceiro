Router.register('cad-categorias', function (container) {

  function buildRow(c) {
    var badgeCls = c.tipo === 'Receita' ? 'badge-income' : c.tipo === 'Ambas' ? 'badge-both' : 'badge-expense';
    return '<tr data-id="' + c.id + '">' +
      '<td><strong>' + c.nome + '</strong></td>' +
      '<td><span class="badge ' + badgeCls + '">' + c.tipo + '</span></td>' +
      '<td><div style="display:flex;align-items:center;gap:8px">' +
        '<div style="width:18px;height:18px;border-radius:50%;background:' + c.cor + '"></div>' +
        '<span style="font-size:13px;color:var(--color-muted)">' + c.cor + '</span>' +
      '</div></td>' +
      '<td style="display:flex;gap:6px;padding:10px 22px">' +
        '<button class="btn btn-outline btn-editar-cat" data-id="' + c.id + '" style="font-size:12px;padding:5px 12px">Editar</button>' +
        '<button class="btn btn-excluir-cat" data-id="' + c.id + '" style="font-size:12px;padding:5px 12px;background:var(--color-expense-bg);color:var(--color-expense);border-radius:8px;font-weight:600">Excluir</button>' +
      '</td>' +
    '</tr>';
  }

  container.innerHTML =
    '<div class="page-header">' +
      '<h2>Categorias</h2>' +
      '<button class="btn btn-primary" id="btn-nova-cat">+ Nova Categoria</button>' +
    '</div>' +
    '<div class="section-box">' +
      '<table class="data-table">' +
        '<thead><tr><th>Nome</th><th>Tipo</th><th>Cor</th><th>Ações</th></tr></thead>' +
        '<tbody id="tbody-categorias">' +
          AppData.categorias.map(buildRow).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';

  // ── Modal ──
  var anterior = document.getElementById('modal-categoria');
  if (anterior) anterior.remove();

  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-categoria';
  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<h3 id="cat-modal-titulo">Nova Categoria</h3>' +
        '<button class="modal-close" id="btn-fechar-cat">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label>Nome</label>' +
          '<input type="text" id="cat-nome" placeholder="Ex: Alimentação" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Tipo</label>' +
          '<select id="cat-tipo">' +
            '<option value="Despesa">Despesa</option>' +
            '<option value="Receita">Receita</option>' +
            '<option value="Ambas">Ambas</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Cor</label>' +
          '<input type="color" id="cat-cor" value="#4361ee" style="height:40px;padding:2px 4px" />' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="btn-cancelar-cat">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-cat">Salvar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  var editandoId = null;

  function preencherModal(c) {
    document.getElementById('cat-modal-titulo').textContent = c ? 'Editar Categoria' : 'Nova Categoria';
    document.getElementById('cat-nome').value = c ? c.nome : '';
    document.getElementById('cat-tipo').value = c ? c.tipo : 'Despesa';
    document.getElementById('cat-cor').value  = c ? c.cor  : '#4361ee';
  }

  function abrirNovo() {
    editandoId = null;
    preencherModal(null);
    modal.classList.add('open');
  }

  function abrirEditar(cat) {
    editandoId = cat.id;
    preencherModal(cat);
    modal.classList.add('open');
  }

  function fechar() { modal.classList.remove('open'); }

  document.getElementById('btn-nova-cat').addEventListener('click', abrirNovo);
  document.getElementById('btn-fechar-cat').addEventListener('click', fechar);
  document.getElementById('btn-cancelar-cat').addEventListener('click', fechar);
  modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

  // Delegação: Editar e Excluir
  document.getElementById('tbody-categorias').addEventListener('click', async function (e) {
    var btnEditar  = e.target.closest('.btn-editar-cat');
    var btnExcluir = e.target.closest('.btn-excluir-cat');

    if (btnEditar) {
      var id  = parseInt(btnEditar.dataset.id);
      var cat = AppData.categorias.find(function (c) { return c.id === id; });
      if (cat) abrirEditar(cat);
    }

    if (btnExcluir) {
      var id  = parseInt(btnExcluir.dataset.id);
      var cat = AppData.categorias.find(function (c) { return c.id === id; });
      if (!cat) return;
      if (!confirm('Excluir a categoria "' + cat.nome + '"?\nEsta ação não pode ser desfeita.')) return;
      await AppData.removeCategoria(id);
      var tr = document.querySelector('#tbody-categorias tr[data-id="' + id + '"]');
      if (tr) tr.remove();
    }
  });

  document.getElementById('btn-salvar-cat').addEventListener('click', async function () {
    var nome = document.getElementById('cat-nome').value.trim();
    var tipo = document.getElementById('cat-tipo').value;
    var cor  = document.getElementById('cat-cor').value;

    if (!nome) { alert('Informe o nome da categoria.'); return; }

    var tbody = document.getElementById('tbody-categorias');

    try {
      if (editandoId !== null) {
        var atualizado = await AppData.updateCategoria(editandoId, { nome: nome, tipo: tipo, cor: cor });
        var tr = tbody.querySelector('tr[data-id="' + editandoId + '"]');
        if (tr) tr.outerHTML = buildRow(atualizado);
      } else {
        var nova = await AppData.addCategoria({ nome: nome, tipo: tipo, cor: cor });
        tbody.insertAdjacentHTML('afterbegin', buildRow(nova));
      }
      fechar();
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      alert('Erro ao salvar categoria. Verifique o console (F12) para detalhes.');
    }
  });
});
