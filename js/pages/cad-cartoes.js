Router.register('cad-cartoes', function (container) {

  function buildRow(c) {
    var limiteFmt = c.limite.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    var exibir = c.exibirMesAMes
      ? '<span class="badge badge-income">Sim</span>'
      : '<span class="badge" style="background:#f3f4f6;color:var(--color-muted)">Não</span>';
    var corSwatch = c.cor
      ? '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + c.cor + ';margin-right:6px;vertical-align:middle;border:1px solid rgba(0,0,0,0.15)"></span>'
      : '';
    return '<tr data-id="' + c.id + '">' +
      '<td>' + corSwatch + '<strong>' + c.nome + '</strong></td>' +
      '<td>' + c.bandeira + '</td>' +
      '<td>' + limiteFmt + '</td>' +
      '<td>Dia ' + c.fechamento + '</td>' +
      '<td>Dia ' + c.vencimento + '</td>' +
      '<td>' + exibir + '</td>' +
      '<td><span class="badge badge-income">Ativo</span></td>' +
      '<td style="display:flex;gap:6px;padding:10px 22px">' +
        '<button class="btn btn-outline btn-editar-cc" data-id="' + c.id + '" style="font-size:12px;padding:5px 12px">Editar</button>' +
        '<button class="btn btn-excluir-cc" data-id="' + c.id + '" style="font-size:12px;padding:5px 12px;background:var(--color-expense-bg);color:var(--color-expense);border-radius:8px;font-weight:600">Excluir</button>' +
      '</td>' +
    '</tr>';
  }

  // Renderiza a página
  container.innerHTML =
    '<div class="page-header">' +
      '<h2>Cartões</h2>' +
      '<button class="btn btn-primary" id="btn-novo-cc">+ Novo Cartão</button>' +
    '</div>' +
    '<div class="section-box">' +
      '<table class="data-table">' +
        '<thead><tr>' +
          '<th>Nome</th><th>Bandeira</th><th>Limite</th><th>Fechamento</th><th>Vencimento</th>' +
          '<th>Exibir na DRE</th><th>Status</th><th>Ações</th>' +
        '</tr></thead>' +
        '<tbody id="tbody-cad-cartoes">' +
          AppData.cartoes.map(buildRow).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';

  // ── Modal ──
  var anterior = document.getElementById('modal-cad-cartao');
  if (anterior) anterior.remove();

  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-cad-cartao';
  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<h3 id="cc-modal-titulo">Novo Cartão</h3>' +
        '<button class="modal-close" id="btn-fechar-cc">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Nome do Cartão</label>' +
            '<input type="text" id="cc-nome" placeholder="Ex: Nubank" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Bandeira</label>' +
            '<select id="cc-bandeira">' +
              '<option>Mastercard</option><option>Visa</option><option>Elo</option><option>Amex</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Limite (R$)</label>' +
            '<input type="number" id="cc-limite" placeholder="0,00" min="0" step="0.01" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Cor do Cartão</label>' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<input type="color" id="cc-cor" value="#8A05BE" class="cc-color-picker" />' +
              '<div id="cc-cor-preview" style="flex:1;height:38px;border-radius:8px;border:1.5px solid var(--color-border);' +
                   'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;' +
                   'transition:background 0.2s,color 0.2s">Prévia</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Dia de Fechamento</label>' +
            '<input type="number" id="cc-fechamento" placeholder="Ex: 10" min="1" max="31" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Dia de Vencimento</label>' +
            '<input type="number" id="cc-vencimento" placeholder="Ex: 17" min="1" max="31" />' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;font-weight:500;font-size:14px">' +
            '<input type="checkbox" id="cc-exibir-mes" style="width:16px;height:16px;accent-color:var(--color-primary)" />' +
            'Exibir total do cartão na DRE' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="btn-cancelar-cc">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-cc">Salvar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  var editandoId = null;

  function atualizarPreviewCor(hex) {
    var preview = document.getElementById('cc-cor-preview');
    if (!preview) return;
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    var textColor = luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    preview.style.background = hex;
    preview.style.color = textColor;
    preview.style.borderColor = 'transparent';
    preview.textContent = hex.toUpperCase();
  }

  function preencherModal(c) {
    document.getElementById('cc-modal-titulo').textContent = c ? 'Editar Cartão' : 'Novo Cartão';
    document.getElementById('cc-nome').value       = c ? c.nome        : '';
    document.getElementById('cc-bandeira').value   = c ? c.bandeira    : 'Mastercard';
    document.getElementById('cc-limite').value     = c ? c.limite      : '';
    document.getElementById('cc-fechamento').value = c ? c.fechamento  : '';
    document.getElementById('cc-vencimento').value = c ? c.vencimento  : '';
    document.getElementById('cc-exibir-mes').checked = c ? c.exibirMesAMes : false;
    var cor = (c && c.cor) ? c.cor : '#8A05BE';
    document.getElementById('cc-cor').value = cor;
    atualizarPreviewCor(cor);
  }

  function abrirNovo() {
    editandoId = null;
    preencherModal(null);
    modal.classList.add('open');
  }

  function abrirEditar(cartao) {
    editandoId = cartao.id;
    preencherModal(cartao);
    modal.classList.add('open');
  }

  function fechar() { modal.classList.remove('open'); }

  document.getElementById('cc-cor').addEventListener('input', function () {
    atualizarPreviewCor(this.value);
  });

  document.getElementById('btn-novo-cc').addEventListener('click', abrirNovo);
  document.getElementById('btn-fechar-cc').addEventListener('click', fechar);
  document.getElementById('btn-cancelar-cc').addEventListener('click', fechar);
  modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

  // Delegação: Editar e Excluir
  document.getElementById('tbody-cad-cartoes').addEventListener('click', async function (e) {
    var btnEditar  = e.target.closest('.btn-editar-cc');
    var btnExcluir = e.target.closest('.btn-excluir-cc');

    if (btnEditar) {
      var id = parseInt(btnEditar.dataset.id);
      var cartao = AppData.cartoes.find(function (c) { return c.id === id; });
      if (cartao) abrirEditar(cartao);
    }

    if (btnExcluir) {
      var id = parseInt(btnExcluir.dataset.id);
      var cartao = AppData.cartoes.find(function (c) { return c.id === id; });
      if (!cartao) return;
      if (!confirm('Excluir o cartão "' + cartao.nome + '"?\nEsta ação não pode ser desfeita.')) return;
      await AppData.removeCartao(id);
      var tr = document.querySelector('#tbody-cad-cartoes tr[data-id="' + id + '"]');
      if (tr) tr.remove();
    }
  });

  document.getElementById('btn-salvar-cc').addEventListener('click', async function () {
    var nome       = document.getElementById('cc-nome').value.trim();
    var bandeira   = document.getElementById('cc-bandeira').value;
    var limite     = parseFloat(document.getElementById('cc-limite').value);
    var fechamento = parseInt(document.getElementById('cc-fechamento').value);
    var vencimento = parseInt(document.getElementById('cc-vencimento').value);
    var exibir     = document.getElementById('cc-exibir-mes').checked;
    var cor        = document.getElementById('cc-cor').value;

    if (!nome || isNaN(limite) || limite <= 0 || !fechamento || !vencimento) {
      alert('Preencha todos os campos corretamente.');
      return;
    }

    var tbody = document.getElementById('tbody-cad-cartoes');

    if (editandoId !== null) {
      var atualizado = await AppData.updateCartao(editandoId, {
        nome: nome, bandeira: bandeira, limite: limite,
        fechamento: fechamento, vencimento: vencimento, exibirMesAMes: exibir, cor: cor
      });
      var tr = tbody.querySelector('tr[data-id="' + editandoId + '"]');
      if (tr) tr.outerHTML = buildRow(atualizado);
    } else {
      var novo = await AppData.addCartao({
        nome: nome, bandeira: bandeira, limite: limite,
        fechamento: fechamento, vencimento: vencimento, exibirMesAMes: exibir, cor: cor
      });
      tbody.insertAdjacentHTML('afterbegin', buildRow(novo));
    }

    fechar();
  });
});
