Router.register('importacao', function (container) {

  var destino              = null; // 'cartao' | 'caixinha'
  var preview              = [];
  var mesSelecionado       = null; // persiste o mês escolhido entre chamadas de renderForm()
  var destinoIdSelecionado = null; // persiste a caixinha/cartão escolhido entre chamadas de renderForm()

  function fmtR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ── Inicializa mesSelecionado a partir do AppState (seletor global do app) ──
  function mesDoAppState() {
    var mm = String(AppState.mesIdx + 1).padStart(2, '0');
    return mm + '/' + AppState.ano;
  }

  // ── Gera opções de mês, pré-selecionando valorSelecionado ──
  function gerarOptsMes(valorSelecionado) {
    var nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var hoje  = new Date();
    var opts  = [];
    for (var i = -24; i <= 3; i++) {
      var d    = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      var mm   = String(d.getMonth() + 1).padStart(2, '0');
      var yyyy = d.getFullYear();
      var val  = mm + '/' + yyyy;
      var sel  = valorSelecionado ? val === valorSelecionado : i === 0;
      opts.push('<option value="' + val + '"' + (sel ? ' selected' : '') + '>' +
                nomes[d.getMonth()] + ' ' + yyyy + '</option>');
    }
    return opts.join('');
  }

  // ── Parse CSV ──
  function parseCSV(texto, tipo) {
    var linhas = texto.trim().split('\n').filter(function (l) { return l.trim(); });
    var erros  = [];
    var itens  = [];

    linhas.forEach(function (linha, idx) {
      var cols = linha.split(';').map(function (c) { return c.trim(); });

      if (tipo === 'cartao') {
        if (cols.length < 6) { erros.push('Linha ' + (idx + 1) + ': esperado 6 colunas.'); return; }
        var totalParcelas = parseInt(cols[1]) || 1;
        var parcelaAtual  = parseInt(cols[2]) || 1;
        if (parcelaAtual > totalParcelas) {
          erros.push('Linha ' + (idx + 1) + ': parcela atual (' + parcelaAtual + ') maior que total (' + totalParcelas + ').'); return;
        }
        var valor = parseFloat(cols[5].replace(',', '.'));
        if (isNaN(valor) || valor <= 0) { erros.push('Linha ' + (idx + 1) + ': valor inválido.'); return; }
        itens.push({
          desc:            cols[0],
          totalParcelas:   totalParcelas,
          parcelaAtual:    parcelaAtual,
          responsavelNome: cols[3],
          cat:             cols[4],
          valor:           valor,
        });
      } else {
        if (cols.length < 4) { erros.push('Linha ' + (idx + 1) + ': esperado 4 colunas.'); return; }
        var tipo2 = cols[2].toLowerCase();
        if (tipo2 !== 'entrada' && tipo2 !== 'saida' && tipo2 !== 'saída') {
          erros.push('Linha ' + (idx + 1) + ': tipo deve ser "entrada" ou "saida".'); return;
        }
        var valor2 = parseFloat(cols[3].replace(',', '.'));
        if (isNaN(valor2) || valor2 <= 0) { erros.push('Linha ' + (idx + 1) + ': valor inválido.'); return; }
        itens.push({ data: cols[0], desc: cols[1], tipo: tipo2 === 'saída' ? 'saida' : tipo2, valor: valor2 });
      }
    });

    return { itens: itens, erros: erros };
  }

  // ── Resolve responsável ──
  function resolverResp(nome) {
    if (!nome) return null;
    var n = nome.trim().toLowerCase();
    var r = AppData.responsaveis.find(function (r) {
      return r.nome.toLowerCase() === n || r.nome.split(' ')[0].toLowerCase() === n;
    });
    return r ? r.id : null;
  }

  // ── Desfaz um batch pelo ID ──
  async function desfazerBatch(batchId, btnEl) {
    var batch = AppData.getImportacoes().find(function (b) { return b.id === batchId; });
    if (!batch) { alert('Importação não encontrada.'); return; }

    if (!confirm('Desfazer importação "' + batch.destino_nome + '" (' + batch.total +
                 ' lançamento' + (batch.total !== 1 ? 's' : '') + ')?\nEssa ação não pode ser desfeita.')) return;

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Aguarde...'; }

    try {
      if (batch.tipo === 'cartao') {
        await AppData.removeLancamentosEmMassa(batch.ids || []);
      } else {
        for (var j = 0; j < (batch.ids || []).length; j++) {
          await AppData.removeLancCaixinha(batch.cx_id, batch.ids[j]);
        }
      }
      await AppData.removeImportacao(batchId);
      render();
    } catch (e) {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = '↩ Desfazer'; }
      alert('Erro ao desfazer: ' + (e.message || e));
    }
  }

  // ── Render principal ──
  function render() {
    var batches    = AppData.getImportacoes();
    var ultimo     = batches[0] || null; // mais recente (ordenado por id desc no init)

    var bannerHTML = ultimo
      ? '<div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:16px 20px;' +
          'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px">' +
          '<div>' +
            '<div style="font-weight:700;font-size:14px;color:#92400e">Última importação</div>' +
            '<div style="font-size:13px;color:#b45309;margin-top:2px">' +
              '<strong>' + ultimo.destino_nome + '</strong> &mdash; ' +
              ultimo.total + ' lançamento' + (ultimo.total !== 1 ? 's' : '') +
              ' &mdash; ' + (ultimo.data_hora ? new Date(ultimo.data_hora).toLocaleString('pt-BR') : '') +
            '</div>' +
          '</div>' +
          '<button class="btn" id="btn-desfazer-ultimo" data-id="' + ultimo.id + '" ' +
              'style="background:#ef4444;color:#fff;font-weight:700;padding:8px 18px;' +
              'border-radius:8px;font-size:13px;white-space:nowrap;border:none">' +
            '&#x21A9; Desfazer' +
          '</button>' +
        '</div>'
      : '';

    // Histórico
    var historicoHTML = batches.length
      ? '<div class="section-box" style="margin-top:32px">' +
          '<div class="section-box-header"><h2>Histórico de Importações</h2></div>' +
          '<table class="data-table zebra">' +
            '<thead><tr><th>Data/Hora</th><th>Destino</th><th>Lançamentos</th><th></th></tr></thead>' +
            '<tbody>' +
              batches.map(function (b) {
                var dataHora = b.data_hora ? new Date(b.data_hora).toLocaleString('pt-BR') : '—';
                return '<tr>' +
                  '<td style="color:var(--color-muted);font-size:13px">' + dataHora + '</td>' +
                  '<td><strong>' + b.destino_nome + '</strong></td>' +
                  '<td>' + b.total + ' lançamento' + (b.total !== 1 ? 's' : '') + '</td>' +
                  '<td><button class="btn btn-desfazer-batch" data-id="' + b.id + '" ' +
                      'style="font-size:12px;padding:4px 12px;background:#ef4444;color:#fff;' +
                      'border-radius:8px;font-weight:600;border:none">↩ Desfazer</button></td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>'
      : '';

    container.innerHTML =
      '<div class="page-header"><h2>Importação</h2></div>' +
      '<p style="font-size:14px;color:var(--color-muted);margin:-8px 0 24px">' +
        'Escolha o destino e cole os dados no formato CSV.</p>' +

      bannerHTML +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:600px;margin-bottom:32px">' +
        '<div class="imp-dest' + (destino === 'cartao'   ? ' imp-dest-sel' : '') + '" id="imp-btn-cartao">' +
          '<i class="ph ph-credit-card" style="font-size:36px;margin-bottom:10px;display:block;color:var(--color-primary)"></i>' +
          '<div style="font-weight:700;font-size:15px">Cartões</div>' +
          '<div style="font-size:12px;color:var(--color-muted);margin-top:4px">Importar lançamentos para um cartão</div>' +
        '</div>' +
        '<div class="imp-dest' + (destino === 'caixinha' ? ' imp-dest-sel' : '') + '" id="imp-btn-caixinha">' +
          '<i class="ph ph-piggy-bank" style="font-size:36px;margin-bottom:10px;display:block;color:var(--color-primary)"></i>' +
          '<div style="font-weight:700;font-size:15px">Caixinhas</div>' +
          '<div style="font-size:12px;color:var(--color-muted);margin-top:4px">Importar lançamentos para uma caixinha</div>' +
        '</div>' +
      '</div>' +

      '<div id="imp-form"></div>' +
      historicoHTML;

    // Botão desfazer último
    var btnUltimo = document.getElementById('btn-desfazer-ultimo');
    if (btnUltimo) {
      btnUltimo.addEventListener('click', function () {
        desfazerBatch(parseInt(btnUltimo.dataset.id), btnUltimo);
      });
    }

    // Botões desfazer do histórico
    container.querySelectorAll('.btn-desfazer-batch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        desfazerBatch(parseInt(btn.dataset.id), btn);
      });
    });

    document.getElementById('imp-btn-cartao').addEventListener('click', function () {
      destino = 'cartao'; preview = []; render(); renderForm();
    });
    document.getElementById('imp-btn-caixinha').addEventListener('click', function () {
      destino = 'caixinha'; preview = []; render(); renderForm();
    });

    if (destino) renderForm();
  }

  // ── Formulário + tabela editável ──
  function renderForm() {
    var formEl = document.getElementById('imp-form');
    if (!formEl) return;

    // Preserva a escolha do usuário entre re-renders; inicializa do AppState na primeira vez
    var elMesAtual = document.getElementById('imp-mes');
    if (elMesAtual) {
      mesSelecionado = elMesAtual.value; // salva antes de destruir o DOM
    } else if (!mesSelecionado) {
      mesSelecionado = mesDoAppState(); // primeira abertura: usa o mês global do app
    }

    // Preserva o destino selecionado (caixinha/cartão) antes de reconstruir o DOM
    var elDestinoAtual = document.getElementById('imp-destino-sel');
    if (elDestinoAtual && elDestinoAtual.value) {
      destinoIdSelecionado = elDestinoAtual.value;
    }

    var optsDestino = destino === 'cartao'
      ? AppData.cartoes.map(function (c) {
          var sel = destinoIdSelecionado && String(c.id) === destinoIdSelecionado ? ' selected' : '';
          return '<option value="' + c.id + '"' + sel + '>' + c.nome + ' (' + c.bandeira + ')</option>';
        }).join('')
      : AppData.caixinhas.map(function (c) {
          var sel = destinoIdSelecionado && String(c.id) === destinoIdSelecionado ? ' selected' : '';
          return '<option value="' + c.id + '"' + sel + '>' + c.nome + '</option>';
        }).join('');

    var selCartaoMes = destino === 'cartao'
      ? '<div class="form-row">' +
          '<div class="form-group"><label>Cartão</label>' +
            '<select id="imp-destino-sel">' + (optsDestino || '<option disabled>Nenhum cadastrado</option>') + '</select>' +
          '</div>' +
          '<div class="form-group"><label>Mês de referência (1ª parcela)</label>' +
            '<select id="imp-mes">' + gerarOptsMes(mesSelecionado) + '</select>' +
          '</div>' +
        '</div>'
      : '<div class="form-group"><label>Caixinha</label>' +
          '<select id="imp-destino-sel">' + (optsDestino || '<option disabled>Nenhuma cadastrada</option>') + '</select>' +
        '</div>';

    var formato = destino === 'cartao'
      ? '<code>Descrição;Nº parcelas;Parcela atual;Responsável;Categoria;Valor</code>'
      : '<code>DD/MM/AAAA;Descrição;entrada ou saida;Valor</code>';

    var placeholder = destino === 'cartao'
      ? 'Ex: Reels de Impacto;12;8;Dhavy;Educação;8,17\nEx: Supermercado;1;1;João;Mercado;320,50'
      : 'Ex: 01/03/2026;Depósito mensal;entrada;500,00';

    // ── Tabela editável de revisão ──
    var previewHTML = '';
    if (preview.length) {
      var inpStyle = 'width:100%;border:1.5px solid var(--color-border);border-radius:6px;' +
                     'padding:5px 8px;font-size:13px;background:var(--color-surface);box-sizing:border-box';
      var remBtn   = '<button class="btn-remover-linha" style="background:var(--color-expense-bg);color:var(--color-expense);' +
                     'border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">✕ Remover</button>';

      // Conjuntos para validação rápida
      var catSet  = {};
      AppData.categorias.forEach(function (c) { catSet[c.nome] = true; });
      var respSet = {};
      AppData.responsaveis.forEach(function (r) {
        respSet[r.nome.toLowerCase()] = true;
        r.nome.split(' ')[0] && (respSet[r.nome.split(' ')[0].toLowerCase()] = true);
      });

      var linhas = '';

      if (destino === 'cartao') {
        var totalLancs = preview.reduce(function (s, it) { return s + (it.totalParcelas - it.parcelaAtual + 1); }, 0);

        linhas = preview.map(function (item, idx) {
          var qtd      = item.totalParcelas - item.parcelaAtual + 1;
          var parcLabel = item.totalParcelas > 1
            ? item.parcelaAtual + 'ª → ' + item.totalParcelas + 'ª &nbsp;<span style="color:var(--color-primary);font-weight:700">(+' + qtd + ')</span>'
            : '<span style="color:var(--color-muted)">à vista</span>';

          // Responsável: resolve nome → opção selecionada
          var respNomeNorm = (item.responsavelNome || '').toLowerCase();
          var respValido   = !item.responsavelNome || respSet[respNomeNorm];
          var respMatch    = '';
          AppData.responsaveis.forEach(function (r) {
            if (r.nome.toLowerCase() === respNomeNorm || r.nome.split(' ')[0].toLowerCase() === respNomeNorm) respMatch = r.nome;
          });
          var optsRespRow = '<option value="">— Sem responsável —</option>' +
            AppData.responsaveis.map(function (r) {
              return '<option value="' + r.nome + '"' + (r.nome === respMatch ? ' selected' : '') + '>' + r.nome + '</option>';
            }).join('');

          // Categoria: valida e destaca se não existir
          var catValido   = catSet[item.cat];
          var optsCatRow  = AppData.categorias.map(function (c) {
            return '<option value="' + c.nome + '"' + (c.nome === item.cat ? ' selected' : '') + '>' + c.nome + '</option>';
          }).join('');
          if (!catValido) {
            optsCatRow = '<option value="' + item.cat + '" selected>' + item.cat + ' ⚠</option>' + optsCatRow;
          }

          return '<tr data-idx="' + idx + '" data-parcela-atual="' + item.parcelaAtual + '" data-total-parcelas="' + item.totalParcelas + '">' +
            '<td style="min-width:150px"><input type="text" class="p-desc" value="' + item.desc.replace(/"/g, '&quot;') + '" style="' + inpStyle + '"></td>' +
            '<td style="font-size:12px;white-space:nowrap;text-align:center">' + parcLabel + '</td>' +
            '<td style="min-width:130px"><select class="p-resp" style="' + inpStyle + (respValido ? '' : ';border-color:#f87171') + '">' + optsRespRow + '</select></td>' +
            '<td style="min-width:130px"><select class="p-cat" style="' + inpStyle + (catValido ? '' : ';border-color:#f87171') + '">' + optsCatRow + '</select></td>' +
            '<td style="min-width:90px"><input type="number" class="p-valor" value="' + item.valor + '" min="0.01" step="0.01" style="' + inpStyle + ';max-width:88px"></td>' +
            '<td>' + remBtn + '</td>' +
          '</tr>';
        }).join('');

        var temInvalido = preview.some(function (it) { return !catSet[it.cat]; });
        previewHTML =
          '<div class="section-box" style="margin-top:20px">' +
            '<div class="section-box-header">' +
              '<h2>Revisar importação &nbsp;<span id="imp-total-count" style="font-size:13px;font-weight:400;color:var(--color-muted)">' +
                preview.length + ' linha' + (preview.length !== 1 ? 's' : '') +
                (totalLancs !== preview.length ? ' → ' + totalLancs + ' lançamentos' : '') +
              '</span></h2>' +
            '</div>' +
            (temInvalido ? '<p style="font-size:12px;color:#b91c1c;padding:8px 20px 0"><strong>⚠</strong> Campos com borda vermelha têm categoria não cadastrada — ajuste antes de confirmar.</p>' : '') +
            '<div style="overflow-x:auto">' +
              '<table class="data-table" style="min-width:720px">' +
                '<thead><tr><th>Descrição</th><th style="text-align:center">Parcelas</th><th>Responsável</th><th>Categoria</th><th>Valor/parc.</th><th></th></tr></thead>' +
                '<tbody id="preview-tbody">' + linhas + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-primary" id="imp-confirmar" style="margin-top:16px;padding:10px 28px;font-size:14px">' +
            '<i class="ph ph-check" style="margin-right:6px"></i>Confirmar e salvar tudo' +
          '</button>';

      } else {
        // Caixinha
        linhas = preview.map(function (item, idx) {
          var dp      = (item.data || '').split('/');
          var dataISO = dp.length === 3 ? dp[2] + '-' + dp[1] + '-' + dp[0] : '';
          var ent     = item.tipo === 'entrada';
          return '<tr data-idx="' + idx + '">' +
            '<td><input type="date" class="p-data" value="' + dataISO + '" style="' + inpStyle + '"></td>' +
            '<td style="min-width:160px"><input type="text" class="p-desc" value="' + item.desc.replace(/"/g, '&quot;') + '" style="' + inpStyle + '"></td>' +
            '<td><select class="p-tipo" style="' + inpStyle + '">' +
              '<option value="entrada"' + (ent ? ' selected' : '') + '>Entrada</option>' +
              '<option value="saida"' + (!ent ? ' selected' : '') + '>Saída</option>' +
            '</select></td>' +
            '<td><input type="number" class="p-valor" value="' + item.valor + '" min="0.01" step="0.01" style="' + inpStyle + ';max-width:88px"></td>' +
            '<td>' + remBtn + '</td>' +
          '</tr>';
        }).join('');

        previewHTML =
          '<div class="section-box" style="margin-top:20px">' +
            '<div class="section-box-header">' +
              '<h2>Revisar importação &nbsp;<span id="imp-total-count" style="font-size:13px;font-weight:400;color:var(--color-muted)">' +
                preview.length + ' item' + (preview.length !== 1 ? 's' : '') + '</span></h2>' +
            '</div>' +
            '<table class="data-table">' +
              '<thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th></th></tr></thead>' +
              '<tbody id="preview-tbody">' + linhas + '</tbody>' +
            '</table>' +
          '</div>' +
          '<button class="btn btn-primary" id="imp-confirmar" style="margin-top:16px;padding:10px 28px;font-size:14px">' +
            '<i class="ph ph-check" style="margin-right:6px"></i>Confirmar e salvar tudo' +
          '</button>';
      }
    }

    formEl.innerHTML =
      '<div class="section-box">' +
        '<div class="section-box-header"><h2>Dados · ' + (destino === 'cartao' ? 'Cartões' : 'Caixinhas') + '</h2></div>' +
        '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px">' +
          selCartaoMes +
          '<div class="form-group">' +
            '<label>Formato: ' + formato + '</label>' +
            '<textarea id="imp-csv" rows="6" style="width:100%;padding:10px 12px;border:1.5px solid var(--color-border);' +
              'border-radius:8px;font-size:13px;font-family:monospace;resize:vertical" placeholder="' + placeholder + '"></textarea>' +
          '</div>' +
          '<button class="btn btn-outline" id="imp-visualizar" style="align-self:flex-start;padding:8px 22px">' +
            '<i class="ph ph-eye" style="margin-right:6px"></i>Pré-visualizar e revisar' +
          '</button>' +
        '</div>' +
      '</div>' +
      previewHTML;

    // Atualiza mesSelecionado e destinoIdSelecionado imediatamente quando o usuário muda os seletores
    var elImpMes = document.getElementById('imp-mes');
    if (elImpMes) {
      elImpMes.addEventListener('change', function () { mesSelecionado = this.value; });
    }
    var elImpDest = document.getElementById('imp-destino-sel');
    if (elImpDest) {
      elImpDest.addEventListener('change', function () { destinoIdSelecionado = this.value; });
    }

    // ── Pré-visualizar ──
    document.getElementById('imp-visualizar').addEventListener('click', function () {
      var texto = document.getElementById('imp-csv').value.trim();
      if (!texto) { alert('Cole os dados antes de pré-visualizar.'); return; }
      var res = parseCSV(texto, destino);
      if (res.erros.length) {
        alert('Erros encontrados:\n' + res.erros.join('\n'));
        if (!res.itens.length) return;
      }
      preview = res.itens;
      renderForm();
      // Rola para a tabela de revisão
      setTimeout(function () {
        var el = document.getElementById('preview-tbody');
        if (el) el.closest('.section-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    });

    if (!preview.length) return;

    // ── Remover linha ──
    document.getElementById('preview-tbody').addEventListener('click', function (e) {
      if (!e.target.classList.contains('btn-remover-linha')) return;
      var tr = e.target.closest('tr');
      if (tr) {
        tr.remove();
        var restantes = document.querySelectorAll('#preview-tbody tr').length;
        var countEl   = document.getElementById('imp-total-count');
        if (countEl) countEl.textContent = restantes + (destino === 'cartao' ? ' linha' + (restantes !== 1 ? 's' : '') : ' item' + (restantes !== 1 ? 's' : ''));
        if (!restantes) {
          var btnConf = document.getElementById('imp-confirmar');
          if (btnConf) btnConf.style.display = 'none';
        }
      }
    });

    // ── Confirmar e salvar ──
    document.getElementById('imp-confirmar').addEventListener('click', async function () {
      var btn       = this;
      var destinoId = document.getElementById('imp-destino-sel').value;
      if (!destinoId) { alert('Selecione o destino.'); return; }

      var rows = document.querySelectorAll('#preview-tbody tr');
      if (!rows.length) { alert('Nenhum item para importar.'); return; }

      btn.disabled = true;
      btn.textContent = 'Aguarde, importando...';

      var importados    = 0;
      var idsImportados = [];

      try {
        if (destino === 'cartao') {
          // Lê o mês diretamente do select (que agora persiste corretamente)
          var mesSel   = document.getElementById('imp-mes').value; // "MM/YYYY"
          var partes   = mesSel.split('/');  // [0]=MM, [1]=YYYY
          var cartaoId = parseInt(destinoId);
          var cartao   = AppData.cartoes.find(function (c) { return c.id === cartaoId; });

          for (var i = 0; i < rows.length; i++) {
            var row           = rows[i];
            var desc          = row.querySelector('.p-desc').value.trim();
            var respNome      = row.querySelector('.p-resp').value;
            var cat           = row.querySelector('.p-cat').value;
            var valor         = parseFloat(row.querySelector('.p-valor').value);
            var parcelaAtual  = parseInt(row.dataset.parcelaAtual)  || 1;
            var totalParcelas = parseInt(row.dataset.totalParcelas) || 1;
            if (!desc || isNaN(valor) || valor <= 0) continue;

            // data = '01/MM/YYYY' — addLancamentosParcelados incrementa o mês em cada parcela
            var criados = await AppData.addLancamentosParcelados({
              data:            '01/' + partes[0] + '/' + partes[1],
              desc:            desc,
              cat:             cat,
              cartaoId:        cartaoId,
              cartaoNome:      cartao ? cartao.nome : '',
              responsavelId:   resolverResp(respNome),
              responsavelNome: respNome,
              valor:           valor,
              parcela:         parcelaAtual,
              totalParcelas:   totalParcelas,
            });
            criados.forEach(function (n) { if (n && n.id) idsImportados.push(n.id); });
            importados += criados.length;
          }

          await AppData.addImportacao({
            tipo:        'cartao',
            destinoNome: (cartao ? cartao.nome : 'Cartão') + ' · ' + partes[0] + '/' + partes[1],
            total:       importados,
            ids:         idsImportados,
          });

          // Sincroniza o AppState (seletor global) com o mês importado
          AppState.set(parseInt(partes[0]) - 1, parseInt(partes[1]));

        } else {
          var cxId     = parseInt(destinoId);
          var caixinha = AppData.caixinhas.find(function (c) { return c.id === cxId; });

          for (var j = 0; j < rows.length; j++) {
            var row2   = rows[j];
            var dataV  = row2.querySelector('.p-data').value; // YYYY-MM-DD
            var dp2    = dataV.split('-');
            var dataBR = dp2.length === 3 ? dp2[2] + '/' + dp2[1] + '/' + dp2[0] : dataV;
            var nl     = await AppData.addLancCaixinha(cxId, {
              data:  dataBR,
              desc:  row2.querySelector('.p-desc').value.trim(),
              tipo:  row2.querySelector('.p-tipo').value,
              valor: parseFloat(row2.querySelector('.p-valor').value),
            });
            if (nl && nl.id) idsImportados.push(nl.id);
            importados++;
          }

          await AppData.addImportacao({
            tipo:        'caixinha',
            destinoNome: caixinha ? caixinha.nome : 'Caixinha',
            cxId:        cxId,
            total:       importados,
            ids:         idsImportados,
          });
        }

        // Limpa estado local, recarrega dados do servidor e re-renderiza
        // mesSel = lido ao vivo do DOM (cartão); mesSelecionado = fallback caixinha
        var mesImportado = (typeof mesSel !== 'undefined' ? mesSel : null) || mesSelecionado;
        preview              = [];
        destino              = null;
        mesSelecionado       = null;
        destinoIdSelecionado = null;
        await AppData.init(); // força recarregamento completo do Supabase
        render();
        Router.refresh();

        // Banner de sucesso com o mês exato importado
        var MESES_IMP = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                         'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        var ptsMes = mesImportado ? mesImportado.split('/') : null;
        var nomeMesImp = ptsMes
          ? MESES_IMP[parseInt(ptsMes[0]) - 1] + ' ' + ptsMes[1]
          : '';
        var bannerSucc = document.createElement('div');
        bannerSucc.style.cssText =
          'background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px 20px;' +
          'display:flex;align-items:center;gap:12px;margin-bottom:20px;font-size:14px;color:#166534';
        bannerSucc.innerHTML =
          '<i class="ph ph-check-circle" style="font-size:22px;color:#16a34a;flex-shrink:0"></i>' +
          '<div><strong>' + importados + ' lançamento' + (importados !== 1 ? 's' : '') + ' importados com sucesso</strong>' +
          (nomeMesImp ? ' &mdash; mês <strong>' + nomeMesImp + '</strong>' : '') +
          '. O seletor de competência foi atualizado.</div>';
        var appContent = document.getElementById('app-content');
        if (appContent) appContent.insertBefore(bannerSucc, appContent.firstChild);
        setTimeout(function () { if (bannerSucc.parentNode) bannerSucc.remove(); }, 6000);

      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-check" style="margin-right:6px"></i>Confirmar e salvar tudo';
        alert('Erro durante a importação: ' + (e.message || e));
      }
    });
  }

  render();
});
