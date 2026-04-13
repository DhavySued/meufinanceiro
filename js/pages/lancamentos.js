Router.register('lancamentos', function (container) {

  var tipoAtual = 'despesa';
  var filtros = { cat: '', resp: '' }; // estado dos filtros de cabeçalho

  function dataPadraoDoMes() {
    var mm   = String(AppState.mesIdx + 1).padStart(2, '0');
    var yyyy = String(AppState.ano);
    return '01/' + mm + '/' + yyyy;
  }

  // ── Máscara de data DD/MM/AAAA ──
  function aplicarMascaraData(input) {
    var digits = input.value.replace(/\D/g, '').slice(0, 8);
    var v = digits;
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
    input.value = v;
  }

  function tagParcela(l) {
    if (!l.totalParcelas || l.totalParcelas <= 1) return '';
    return ' <span style="font-size:11px;background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;' +
           'border-radius:20px;padding:2px 9px;font-weight:600;vertical-align:middle;display:inline-block">' +
           l.parcela + '/' + l.totalParcelas + '</span>';
  }

  function buildRow(l) {
    var val     = Math.abs(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    var isRec   = l.tipo === 'receita';
    var valHTML = '<span class="' + (isRec ? 'amount-income' : 'amount-expense') + '">' +
                  (isRec ? '+' : '-') + val + '</span>';
    var catEsc  = (l.cat || '').replace(/"/g, '&quot;');
    var respNome = l.responsavelNome || '';
    var respEsc  = respNome.replace(/"/g, '&quot;');
    return '<tr data-id="' + l.id + '" data-cat="' + catEsc + '" data-resp="' + respEsc +
           '" data-tipo="' + l.tipo + '" data-valor="' + l.valor + '">' +
      '<td style="color:var(--color-muted);font-size:13px">' + l.data + '</td>' +
      '<td><strong>' + l.desc + '</strong>' + tagParcela(l) + '</td>' +
      '<td style="color:var(--color-muted)">' + l.cat + '</td>' +
      '<td style="font-size:13px">' + l.cartaoNome + '</td>' +
      '<td>' + (respNome
        ? '<span class="resp-badge">' + respNome + '</span>'
        : '<span style="color:var(--color-muted);font-size:12px">—</span>') + '</td>' +
      '<td>' + valHTML + '</td>' +
    '</tr>';
  }

  function optsCartoes() {
    return AppData.cartoes.map(function (c) {
      return '<option value="' + c.id + '" data-nome="' + c.nome + '">' + c.nome + '</option>';
    }).join('');
  }

  function optsCategorias() {
    return AppData.categorias.map(function (c) {
      return '<option value="' + c.nome + '">' + c.nome + '</option>';
    }).join('');
  }

  function optsResponsaveis() {
    var opts = '<option value="" data-nome="">— Nenhum —</option>';
    opts += AppData.responsaveis.map(function (r) {
      return '<option value="' + r.id + '" data-nome="' + r.nome.replace(/"/g,'&quot;') + '">' + r.nome + '</option>';
    }).join('');
    return opts;
  }

  // ── Ícone de funil (SVG inline compacto) ──
  var FUNNEL_SVG =
    '<svg class="th-funnel-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M1.5 2h13l-5 6v5l-3-1.5V8L1.5 2z"/>' +
    '</svg>';

  function getLancamentosMes() {
    var mesNum = String(AppState.mesIdx + 1).padStart(2, '0');
    var mesRef = String(AppState.ano) + '-' + mesNum;
    return AppData.getLancamentos().filter(function (l) {
      return AppData.getMesRef(l) === mesRef;
    });
  }

  var rowsHTML = getLancamentosMes().map(buildRow).join('');

  container.innerHTML =
    '<div class="page-header">' +
      '<h2>Lançamentos de Cartão</h2>' +
      '<button class="btn btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>' +
    '</div>' +
    '<div class="section-box">' +
      '<div class="filter-bar">' +
        '<input type="text" id="filtro-busca" placeholder="🔍  Buscar lançamento..." />' +
        '<span class="filter-bar-total">Total visível: <strong id="lanc-total">—</strong></span>' +
      '</div>' +
      '<table class="data-table">' +
        '<thead><tr>' +
          '<th>Data</th>' +
          '<th>Descrição</th>' +
          '<th class="th-filterable" id="th-cat">Categoria ' + FUNNEL_SVG + '</th>' +
          '<th>Cartão</th>' +
          '<th class="th-filterable" id="th-resp">Responsável ' + FUNNEL_SVG + '</th>' +
          '<th>Valor</th>' +
        '</tr></thead>' +
        '<tbody id="tbody-lancamentos">' + rowsHTML + '</tbody>' +
      '</table>' +
    '</div>';

  // ── Calcular total das linhas visíveis ──
  function calcularTotal() {
    var total = 0;
    var rows = document.querySelectorAll('#tbody-lancamentos tr');
    rows.forEach(function (tr) {
      if (tr.style.display === 'none') return;
      var v = parseFloat(tr.dataset.valor) || 0;
      total += tr.dataset.tipo === 'receita' ? v : -v;
    });
    var el = document.getElementById('lanc-total');
    if (!el) return;
    var abs = Math.abs(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    el.textContent = (total >= 0 ? '+' : '-') + ' ' + abs;
    el.style.color = total >= 0 ? 'var(--color-income,#16a34a)' : 'var(--color-expense,#dc2626)';
  }

  // ── Aplicar todos os filtros combinados ──
  function aplicarFiltros() {
    var busca = (document.getElementById('filtro-busca').value || '').toLowerCase();
    var rows  = document.querySelectorAll('#tbody-lancamentos tr');
    rows.forEach(function (tr) {
      var cat  = tr.dataset.cat  || '';
      var resp = tr.dataset.resp || '';
      var texto = tr.textContent.toLowerCase();
      var ok = true;
      if (filtros.cat  && cat  !== filtros.cat)  ok = false;
      if (filtros.resp && resp !== filtros.resp)  ok = false;
      if (busca && texto.indexOf(busca) === -1)   ok = false;
      tr.style.display = ok ? '' : 'none';
    });
    // indicadores visuais
    var thCat  = document.getElementById('th-cat');
    var thResp = document.getElementById('th-resp');
    if (thCat)  thCat.classList.toggle('th-filter-active',  !!filtros.cat);
    if (thResp) thResp.classList.toggle('th-filter-active', !!filtros.resp);
    calcularTotal();
  }

  // ── Dropdown de filtro no cabeçalho ──
  function fecharDropdown() {
    var d = document.getElementById('header-filter-popup');
    if (d) d.remove();
  }

  function abrirDropdownFiltro(th, col) {
    fecharDropdown();

    var todas = getLancamentosMes();
    var opts = [];

    if (col === 'resp') {
      // para responsável: listar todos os cadastrados, não só os que aparecem nos lançamentos
      AppData.responsaveis.forEach(function (r) {
        if (r.nome && opts.indexOf(r.nome) === -1) opts.push(r.nome);
      });
    } else {
      // para categoria: valores únicos dos lançamentos
      todas.forEach(function (l) {
        var v = l.cat || '';
        if (v && opts.indexOf(v) === -1) opts.push(v);
      });
    }
    opts.sort();

    var popup = document.createElement('div');
    popup.id = 'header-filter-popup';
    popup.className = 'header-filter-popup';

    var current = filtros[col];
    var html = '<div class="hfp-item' + (!current ? ' hfp-item-active' : '') + '" data-val="">' +
               '<span class="hfp-check">✓</span>Todos</div>';
    opts.forEach(function (o) {
      var oEsc   = o.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var valEsc = o.replace(/"/g, '&quot;');
      html += '<div class="hfp-item' + (o === current ? ' hfp-item-active' : '') +
              '" data-val="' + valEsc + '"><span class="hfp-check">✓</span>' + oEsc + '</div>';
    });
    popup.innerHTML = html;

    // posicionar abaixo do th clicado
    var rect = th.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top      = (rect.bottom + 4) + 'px';
    popup.style.left     = rect.left + 'px';
    popup.style.minWidth = Math.max(rect.width, 180) + 'px';

    popup.addEventListener('click', function (e) {
      var item = e.target.closest('.hfp-item');
      if (!item) return;
      filtros[col] = item.dataset.val;
      fecharDropdown();
      aplicarFiltros();
    });

    document.body.appendChild(popup);

    setTimeout(function () {
      function onOutside(e) {
        if (!e.target.closest('#header-filter-popup') && !e.target.closest('.th-filterable')) {
          fecharDropdown();
          document.removeEventListener('click', onOutside);
        }
      }
      document.addEventListener('click', onOutside);
    }, 0);
  }

  // conectar headers clicáveis
  document.getElementById('th-cat').addEventListener('click', function (e) {
    e.stopPropagation();
    abrirDropdownFiltro(this, 'cat');
  });
  document.getElementById('th-resp').addEventListener('click', function (e) {
    e.stopPropagation();
    abrirDropdownFiltro(this, 'resp');
  });

  // conectar busca de texto
  document.getElementById('filtro-busca').addEventListener('input', aplicarFiltros);

  // calcular total inicial
  calcularTotal();

  // ── Modal ──
  var anterior = document.getElementById('modal-novo-lancamento');
  if (anterior) anterior.remove();

  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-novo-lancamento';
  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<h3>Novo Lançamento de Cartão</h3>' +
        '<button class="modal-close" id="btn-fechar-lanc">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +

        // ── Toggle Receita / Despesa ──
        '<div class="form-group">' +
          '<label>Tipo</label>' +
          '<div class="tipo-toggle">' +
            '<button type="button" class="tipo-btn tipo-btn-receita" id="tipo-receita">' +
              '<i class="ph ph-arrow-circle-up" style="pointer-events:none"></i> Receita' +
            '</button>' +
            '<button type="button" class="tipo-btn tipo-btn-despesa tipo-btn-active" id="tipo-despesa">' +
              '<i class="ph ph-arrow-circle-down" style="pointer-events:none"></i> Despesa' +
            '</button>' +
          '</div>' +
        '</div>' +

        // ── Data + Cartão ──
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Data <span style="font-size:11px;color:var(--color-muted);font-weight:400">(DD/MM/AAAA)</span></label>' +
            '<input type="text" id="form-data" placeholder="DD/MM/AAAA" maxlength="10" ' +
                   'autocomplete="off" inputmode="numeric" style="letter-spacing:1px" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Cartão</label>' +
            '<select id="form-cartao">' + optsCartoes() + '</select>' +
          '</div>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Descrição</label>' +
          '<input type="text" id="form-desc" placeholder="Ex: Supermercado Extra" />' +
        '</div>' +

        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Categoria</label>' +
            '<select id="form-cat">' + optsCategorias() + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Responsável</label>' +
            '<select id="form-resp">' + optsResponsaveis() + '</select>' +
          '</div>' +
        '</div>' +

        '<div class="form-group">' +
          '<label>Valor (R$)</label>' +
          '<input type="number" id="form-valor" placeholder="0,00" min="0" step="0.01" />' +
        '</div>' +

        // ── Toggle parcelamento ──
        '<div class="form-group" style="margin-top:4px">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">' +
            '<input type="checkbox" id="form-parcelado" style="width:16px;height:16px;cursor:pointer" />' +
            '<span>Compra parcelada</span>' +
            '<span style="font-size:11px;background:#e0e7ff;color:#4f46e5;border-radius:20px;' +
                  'padding:2px 8px;font-weight:700;margin-left:4px">⅟ parcelada</span>' +
          '</label>' +
        '</div>' +

        '<div id="form-parcelas-wrap" style="display:none">' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Iniciar da parcela nº</label>' +
              '<input type="number" id="form-parcela-atual" min="1" value="1" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Total de parcelas</label>' +
              '<input type="number" id="form-total-parcelas" min="2" value="2" />' +
            '</div>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--color-muted);margin-top:-4px">' +
            'Ex: parcela 6 de 10 → cria apenas as parcelas 6, 7, 8, 9 e 10, uma por mês.' +
          '</p>' +
        '</div>' +

      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="btn-cancelar-lanc">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-lanc">Salvar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // ── Preenche data padrão ──
  document.getElementById('form-data').value = dataPadraoDoMes();

  // ── Tipo toggle ──
  function setTipo(t) {
    tipoAtual = t;
    var btnR = document.getElementById('tipo-receita');
    var btnD = document.getElementById('tipo-despesa');
    btnR.classList.toggle('tipo-btn-active', t === 'receita');
    btnD.classList.toggle('tipo-btn-active', t === 'despesa');
  }
  document.getElementById('tipo-receita').addEventListener('click', function () { setTipo('receita'); });
  document.getElementById('tipo-despesa').addEventListener('click', function () { setTipo('despesa'); });

  // ── Máscara de data ──
  document.getElementById('form-data').addEventListener('input', function () {
    aplicarMascaraData(this);
  });
  document.getElementById('form-data').addEventListener('keydown', function (e) {
    var permitidas = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
    if (permitidas.indexOf(e.key) !== -1) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });

  function abrirModal() { modal.classList.add('open'); }

  function fecharModal() {
    modal.classList.remove('open');
    document.getElementById('form-data').value            = dataPadraoDoMes();
    document.getElementById('form-desc').value            = '';
    document.getElementById('form-valor').value           = '';
    document.getElementById('form-resp').value            = '';
    setTipo('despesa');
    document.getElementById('form-parcelado').checked     = false;
    document.getElementById('form-parcelas-wrap').style.display = 'none';
    document.getElementById('form-parcela-atual').value   = '1';
    document.getElementById('form-total-parcelas').value  = '2';
  }

  document.getElementById('btn-novo-lancamento').addEventListener('click', abrirModal);
  document.getElementById('btn-fechar-lanc').addEventListener('click', fecharModal);
  document.getElementById('btn-cancelar-lanc').addEventListener('click', fecharModal);

  if (window._mfFabOpenLancamento) {
    window._mfFabOpenLancamento = false;
    setTimeout(abrirModal, 80);
  }
  modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

  document.getElementById('form-parcelado').addEventListener('change', function () {
    document.getElementById('form-parcelas-wrap').style.display = this.checked ? 'block' : 'none';
  });

  document.getElementById('btn-salvar-lanc').addEventListener('click', async function () {
    var desc      = document.getElementById('form-desc').value.trim();
    var valor     = parseFloat(document.getElementById('form-valor').value);
    var data      = document.getElementById('form-data').value;
    var cat       = document.getElementById('form-cat').value;
    var selCartao = document.getElementById('form-cartao');
    var cartaoId  = parseInt(selCartao.value);
    var cartaoNome = selCartao.options[selCartao.selectedIndex].dataset.nome;
    var selResp   = document.getElementById('form-resp');
    var respId    = selResp.value ? parseInt(selResp.value) : null;
    var respNome  = selResp.value ? selResp.options[selResp.selectedIndex].dataset.nome : null;
    var parcelado  = document.getElementById('form-parcelado').checked;

    if (!desc || isNaN(valor) || valor <= 0) {
      alert('Preencha a descrição e o valor corretamente.');
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      alert('Data inválida. Use o formato DD/MM/AAAA (ex: 01/04/2026).');
      document.getElementById('form-data').focus();
      return;
    }

    if (parcelado) {
      var parcelaAtual  = parseInt(document.getElementById('form-parcela-atual').value)  || 1;
      var totalParcelas = parseInt(document.getElementById('form-total-parcelas').value) || 2;
      if (parcelaAtual > totalParcelas) {
        alert('Parcela atual não pode ser maior que o total de parcelas.'); return;
      }

      var valorSigned = tipoAtual === 'receita' ? Math.abs(valor) : -Math.abs(valor);
      var criados = await AppData.addLancamentosParcelados({
        data:            data,
        desc:            desc,
        cat:             cat,
        cartaoId:        cartaoId,
        cartaoNome:      cartaoNome,
        valor:           valorSigned,
        parcela:         parcelaAtual,
        totalParcelas:   totalParcelas,
        tipo:            tipoAtual,
        responsavelId:   respId,
        responsavelNome: respNome,
      });
      var mesRefAtual = String(AppState.ano) + '-' + String(AppState.mesIdx + 1).padStart(2, '0');
      criados.forEach(function (novo) {
        if (AppData.getMesRef(novo) !== mesRefAtual) return;
        document.getElementById('tbody-lancamentos').insertAdjacentHTML('afterbegin', buildRow(novo));
      });
    } else {
      var novo2 = await AppData.addLancamento({
        data:            data,
        desc:            desc,
        cat:             cat,
        cartaoId:        cartaoId,
        cartaoNome:      cartaoNome,
        valor:           tipoAtual === 'receita' ? Math.abs(valor) : -Math.abs(valor),
        tipo:            tipoAtual,
        responsavelId:   respId,
        responsavelNome: respNome,
      });
      document.getElementById('tbody-lancamentos').insertAdjacentHTML('afterbegin', buildRow(novo2));
    }

    fecharModal();
    aplicarFiltros();
  });
});
