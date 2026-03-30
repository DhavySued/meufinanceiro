// Persiste filtros entre trocas de mês (Router.refresh não reseta)
var _dashRespIds  = [];      // [] = todos os responsáveis
var _dashVisao    = 'geral'; // 'geral' | 'cartao' | 'dre'
var _dashCartaoId = '';      // '' = todos os cartões
var _dashCat      = [];      // [] = todas as categorias

Router.register('dashboard', function (container) {

  var pieChart = null;

  var MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function fmtR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── DRE: replica a lógica de cálculo do mes-a-mes.js ──
  function calcDREResp(mesIdx, resp, cat) {
    var mesNum = String(mesIdx + 1).padStart(2, '0');

    var respId = resp.id;

    var totalR = (resp.ganhos || []).reduce(function (s, g) { return s + g.valor; }, 0);
    var totalD = 0;

    AppData.getCartoesFluxo().forEach(function (c) {
      AppData.getLancamentos()
        .filter(function (l) {
          if (l.cartaoId !== c.id) return false;
          if (l.data.split('/')[1] !== mesNum) return false;
          if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return false;
          if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respId; });
          return l.responsavelId === respId;
        })
        .forEach(function (l) {
          var v;
          if (l.isDividido && l.splits) {
            var sp = l.splits.find(function (s) { return s.respId === respId; });
            v = sp ? Math.abs(sp.valor) : 0;
          } else {
            v = Math.abs(l.valor);
          }
          totalD += l.tipo === 'receita' ? -v : v;
        });
    });

    (resp.orcamentos || []).forEach(function (m) {
      var gasto = AppData.getLancamentos()
        .filter(function (l) { return l.cat === m.catNome && l.data.split('/')[1] === mesNum && l.responsavelId === respId; })
        .reduce(function (s, l) { return s + (l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor)); }, 0);
      totalD += Math.max(0, m.limite - gasto);
    });

    (resp.despesasFixas || []).forEach(function (d) { totalD += d.valor; });

    AppData.getDespesasManuais(mesIdx, respId).forEach(function (d) { totalD += d.valor; });

    return { receita: totalR, despesa: totalD };
  }

  // ── Totais DRE (geral ou por responsável) ──
  function calcSummaryDRE(mesIdx, respId, cat) {
    if (respId === 'geral') {
      var receita = 0, despesa = 0;
      AppData.getFluxoCaixa().forEach(function (r) {
        var d = calcDREResp(mesIdx, r, cat);
        receita += d.receita;
        despesa += d.despesa;
      });
      return { receita: receita, despesa: despesa };
    }
    var resp = AppData.getById(parseInt(respId));
    return resp ? calcDREResp(mesIdx, resp, cat) : { receita: 0, despesa: 0 };
  }

  // ── Totais "Apenas Cartão" (gastos reais nos cartões + receitas DRE) ──
  function calcSummaryCartao(mesIdx, respId, cartaoId, cat) {
    var mesNum  = String(mesIdx + 1).padStart(2, '0');

    var respInt = respId !== 'geral' ? parseInt(respId) : null;

    // Receitas: mantém ganhos configurados no perfil (DRE-style)
    var receita = 0;
    if (respId === 'geral') {
      AppData.getFluxoCaixa().forEach(function (r) {
        receita += (r.ganhos || []).reduce(function (s, g) { return s + g.valor; }, 0);
      });
    } else {
      var resp = AppData.getById(parseInt(respId));
      if (resp) receita = (resp.ganhos || []).reduce(function (s, g) { return s + g.valor; }, 0);
    }

    // Despesas: apenas lançamentos de cartão
    var despesa = 0;
    var cartoesFiltro = cartaoId
      ? AppData.cartoes.filter(function (c) { return c.id === parseInt(cartaoId); })
      : AppData.cartoes;

    cartoesFiltro.forEach(function (c) {
      AppData.getLancamentos()
        .filter(function (l) {
          if (l.cartaoId !== c.id) return false;
          if (l.data.split('/')[1] !== mesNum) return false;
          if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return false;
          if (respInt !== null) {
            if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respInt; });
            return l.responsavelId === respInt;
          }
          return true;
        })
        .forEach(function (l) {
          var v;
          if (respInt !== null && l.isDividido && l.splits) {
            var sp = l.splits.find(function (s) { return s.respId === respInt; });
            v = sp ? Math.abs(sp.valor) : 0;
          } else {
            v = Math.abs(l.valor);
          }
          despesa += l.tipo === 'receita' ? -v : v;
        });
    });

    return { receita: receita, despesa: despesa };
  }

  // ── Totais "Apenas DRE" (fixas + manuais + orçamentos, sem cartão) ──
  function calcSummaryDREOnly(mesIdx, respId) {
    var mesNum = String(mesIdx + 1).padStart(2, '0');

    var resps  = respId === 'geral'
      ? AppData.getFluxoCaixa()
      : [AppData.getById(parseInt(respId))].filter(Boolean);
    var receita = 0, despesa = 0;

    resps.forEach(function (resp) {
      receita += (resp.ganhos || []).reduce(function (s, g) { return s + g.valor; }, 0);

      (resp.orcamentos || []).forEach(function (m) {
        var gasto = AppData.getLancamentos()
          .filter(function (l) { return l.cat === m.catNome && l.data.split('/')[1] === mesNum && l.responsavelId === resp.id; })
          .reduce(function (s, l) { return s + (l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor)); }, 0);
        despesa += Math.max(0, m.limite - gasto);
      });

      (resp.despesasFixas || []).forEach(function (d) { despesa += d.valor; });

      AppData.getDespesasManuais(mesIdx, resp.id).forEach(function (d) { despesa += d.valor; });
    });

    return { receita: receita, despesa: despesa };
  }

  // ── Drill-down Receitas ──
  function getDrillReceitas(mesIdx, respId) {
    var resps = respId === 'geral'
      ? AppData.getFluxoCaixa()
      : [AppData.getById(parseInt(respId))].filter(Boolean);
    var items = [];
    resps.forEach(function (resp) {
      (resp.ganhos || []).forEach(function (g) {
        items.push({ data: '—', desc: g.desc || g.nome || 'Receita', valor: g.valor, cat: 'Receita Fixa', resp: resp.nome });
      });
    });
    return items;
  }

  // ── Drill-down Despesas DRE (todos os tipos) ──
  function getDrillDespesasDRE(mesIdx, respId, cat) {
    var mesNum  = String(mesIdx + 1).padStart(2, '0');

    var respInt = respId !== 'geral' ? parseInt(respId) : null;
    var resps   = respId === 'geral'
      ? AppData.getFluxoCaixa()
      : [AppData.getById(respInt)].filter(Boolean);
    var items   = [];

    AppData.getCartoesFluxo().forEach(function (c) {
      AppData.getLancamentos()
        .filter(function (l) {
          if (l.cartaoId !== c.id) return false;
          if (l.data.split('/')[1] !== mesNum) return false;
          if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return false;
          if (respInt !== null) {
            if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respInt; });
            return l.responsavelId === respInt;
          }
          return true;
        })
        .forEach(function (l) {
          var valor;
          if (respInt !== null && l.isDividido && l.splits) {
            var sp = l.splits.find(function (s) { return s.respId === respInt; });
            valor = sp ? Math.abs(sp.valor) : 0;
          } else {
            valor = Math.abs(l.valor);
          }
          if (valor > 0) items.push({ data: l.data, desc: l.desc, valor: valor, cat: l.cat || '—', cartao: c.nome, parcela: l.parcela, totalParcelas: l.totalParcelas });
        });
    });

    resps.forEach(function (resp) {
      (resp.orcamentos || []).forEach(function (m) {
        var gasto = AppData.getLancamentos()
          .filter(function (l) { return l.cat === m.catNome && l.data.split('/')[1] === mesNum && l.responsavelId === resp.id && l.tipo !== 'receita'; })
          .reduce(function (s, l) { return s + Math.abs(l.valor); }, 0);
        var reserva = Math.max(0, m.limite - gasto);
        if (reserva > 0) items.push({ data: '—', desc: 'Reserva: ' + m.catNome, valor: reserva, cat: 'Orçamento', resp: resp.nome });
      });
    });

    resps.forEach(function (resp) {
      (resp.despesasFixas || []).forEach(function (d) {
        items.push({ data: '—', desc: d.desc || d.nome || 'Despesa Fixa', valor: d.valor, cat: 'Despesa Fixa', resp: resp.nome });
      });
    });

    resps.forEach(function (resp) {
      AppData.getDespesasManuais(mesIdx, resp.id).forEach(function (d) {
        items.push({ data: '—', desc: d.desc || 'Despesa Manual', valor: d.valor, cat: 'Manual', resp: resp.nome });
      });
    });

    items.sort(function (a, b) {
      if (a.data === '—' && b.data !== '—') return 1;
      if (a.data !== '—' && b.data === '—') return -1;
      return 0;
    });

    return items;
  }

  // ── Drill-down Despesas DRE Only (fixas + manuais + orçamentos, sem cartão) ──
  function getDrillDespesasDREOnly(mesIdx, respId) {
    var mesNum = String(mesIdx + 1).padStart(2, '0');

    var resps  = respId === 'geral'
      ? AppData.getFluxoCaixa()
      : [AppData.getById(parseInt(respId))].filter(Boolean);
    var items  = [];

    resps.forEach(function (resp) {
      (resp.orcamentos || []).forEach(function (m) {
        var gasto = AppData.getLancamentos()
          .filter(function (l) { return l.cat === m.catNome && l.data.split('/')[1] === mesNum && l.responsavelId === resp.id && l.tipo !== 'receita'; })
          .reduce(function (s, l) { return s + Math.abs(l.valor); }, 0);
        var reserva = Math.max(0, m.limite - gasto);
        if (reserva > 0) items.push({ data: '—', desc: 'Reserva: ' + m.catNome, valor: reserva, cat: 'Orçamento', resp: resp.nome });
      });

      (resp.despesasFixas || []).forEach(function (d) {
        items.push({ data: '—', desc: d.desc || d.nome || 'Despesa Fixa', valor: d.valor, cat: 'Despesa Fixa', resp: resp.nome });
      });

      AppData.getDespesasManuais(mesIdx, resp.id).forEach(function (d) {
        items.push({ data: '—', desc: d.desc || 'Despesa Manual', valor: d.valor, cat: 'Manual', resp: resp.nome });
      });
    });

    return items;
  }

  // ── Drill-down Despesas Cartão (somente lançamentos de cartão) ──
  function getDrillDespesasCartao(mesIdx, respId, cartaoId, cat) {
    var mesNum  = String(mesIdx + 1).padStart(2, '0');

    var respInt = respId !== 'geral' ? parseInt(respId) : null;
    var cartoesFiltro = cartaoId
      ? AppData.cartoes.filter(function (c) { return c.id === parseInt(cartaoId); })
      : AppData.cartoes;
    var items = [];

    cartoesFiltro.forEach(function (c) {
      AppData.getLancamentos()
        .filter(function (l) {
          if (l.cartaoId !== c.id) return false;
          if (l.data.split('/')[1] !== mesNum) return false;
          if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return false;
          if (respInt !== null) {
            if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respInt; });
            return l.responsavelId === respInt;
          }
          return true;
        })
        .forEach(function (l) {
          var valor;
          if (respInt !== null && l.isDividido && l.splits) {
            var sp = l.splits.find(function (s) { return s.respId === respInt; });
            valor = sp ? Math.abs(sp.valor) : 0;
          } else {
            valor = Math.abs(l.valor);
          }
          if (valor > 0) items.push({ data: l.data, desc: l.desc, valor: valor, tipo: l.tipo || 'despesa', cat: l.cat || '—', cartao: c.nome, parcela: l.parcela, totalParcelas: l.totalParcelas });
        });
    });

    items.sort(function (a, b) {
      if (a.data < b.data) return 1;
      if (a.data > b.data) return -1;
      return 0;
    });

    return items;
  }

  // ── Modal de drill-down (glassmorphism) ──
  function openDrillModal(tipo, items, titulo) {
    var isReceita = tipo === 'receita';
    var corTipo   = isReceita ? 'var(--color-income)' : 'var(--color-expense)';
    var iconTipo  = isReceita ? 'ph-arrow-circle-up' : 'ph-arrow-circle-down';
    var bgIcon    = isReceita ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
    var total     = items.reduce(function (s, i) { return s + i.valor; }, 0);

    var rowsHTML = items.length
      ? items.map(function (item) {
          var itemIsReceita = item.tipo === 'receita';
          var corItem = itemIsReceita ? 'var(--color-income)' : corTipo;
          var sinalItem = itemIsReceita ? '+' : '';
          var badges = '';
          if (item.cartao) badges += '<span class="drill-badge">' + escapeHtml(item.cartao) + '</span>';
          if (item.resp)   badges += '<span class="drill-badge drill-badge-resp">' + escapeHtml(item.resp.split(' ')[0]) + '</span>';
          if (itemIsReceita) badges += '<span class="drill-badge" style="background:rgba(16,185,129,0.12);color:var(--color-income)">Adiantamento</span>';
          if (item.totalParcelas > 1) badges += '<span class="drill-badge drill-badge-parcela">' + item.parcela + '/' + item.totalParcelas + '</span>';
          return '<tr class="drill-row">' +
            '<td class="drill-td drill-td-data">' + escapeHtml(item.data) + '</td>' +
            '<td class="drill-td drill-td-desc"><span class="drill-desc-text">' + escapeHtml(item.desc) + '</span>' + badges + '</td>' +
            '<td class="drill-td drill-td-cat"><span class="drill-cat-pill">' + escapeHtml(item.cat) + '</span></td>' +
            '<td class="drill-td drill-td-val" style="color:' + corItem + '">' + sinalItem + fmtR(item.valor) + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="4" class="drill-empty">Nenhum item encontrado para este período.</td></tr>';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay drill-overlay';
    overlay.innerHTML =
      '<div class="drill-card">' +
        '<div class="drill-header">' +
          '<div class="drill-header-left">' +
            '<div class="drill-header-icon" style="background:' + bgIcon + ';color:' + corTipo + '">' +
              '<i class="ph-fill ' + iconTipo + '"></i>' +
            '</div>' +
            '<div class="drill-header-info">' +
              '<div class="drill-header-title">' + escapeHtml(titulo) + '</div>' +
              '<div class="drill-header-sub" style="color:' + corTipo + '">' +
                fmtR(total) + ' &nbsp;·&nbsp; ' + items.length + ' ' + (items.length === 1 ? 'item' : 'itens') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button class="drill-close" aria-label="Fechar"><i class="ph ph-x"></i></button>' +
        '</div>' +
        '<div class="drill-body">' +
          '<table class="drill-table">' +
            '<thead><tr>' +
              '<th class="drill-th">Data</th>' +
              '<th class="drill-th">Descrição</th>' +
              '<th class="drill-th">Categoria</th>' +
              '<th class="drill-th drill-th-right">Valor</th>' +
            '</tr></thead>' +
            '<tbody>' + rowsHTML + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="drill-footer">' +
          '<span class="drill-footer-label">Total</span>' +
          '<span class="drill-footer-val" style="color:' + corTipo + '">' + fmtR(total) + '</span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function closeModal() {
      overlay.classList.add('drill-overlay-out');
      setTimeout(function () { overlay.remove(); }, 240);
    }

    overlay.querySelector('.drill-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    });

    requestAnimationFrame(function () { overlay.classList.add('drill-overlay-in'); });
  }

  // ── Gasto real por cartão no mês (respeita todos os filtros) ──
  function getGastoPorCartao(mesIdx, respId, cat, visao, cartaoId) {
    // Apenas DRE: cartões não entram no cálculo
    if (visao === 'dre') {
      return AppData.cartoes.map(function (c) { return { cartao: c, total: 0 }; });
    }
    var mesNum  = String(mesIdx + 1).padStart(2, '0');
    var respInt = respId !== 'geral' ? parseInt(respId) : null;
    // Apenas Cartão com cartão específico: filtra a lista de cartões
    var cartoesFiltro = (visao === 'cartao' && cartaoId)
      ? AppData.cartoes.filter(function (c) { return c.id === parseInt(cartaoId); })
      : AppData.cartoes;
    return cartoesFiltro.map(function (c) {
      var total = AppData.getLancamentos()
        .filter(function (l) {
          if (l.cartaoId !== c.id) return false;
          if (l.data.split('/')[1] !== mesNum) return false;
          if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return false;
          if (respInt !== null) {
            if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respInt; });
            return l.responsavelId === respInt;
          }
          return true;
        })
        .reduce(function (s, l) {
          var v;
          if (respInt !== null && l.isDividido && l.splits) {
            var sp = l.splits.find(function (x) { return x.respId === respInt; });
            v = sp ? Math.abs(sp.valor) : 0;
          } else {
            v = Math.abs(l.valor);
          }
          return s + (l.tipo === 'receita' ? -v : v);
        }, 0);
      return { cartao: c, total: total };
    });
  }

  // ── Totais anuais ──
  function calcMesAnual(m) {
    var receita = 0, despesa = 0;
    AppData.getFluxoCaixa().forEach(function (r) {
      var d = calcDREResp(m, r);
      receita += d.receita;
      despesa += d.despesa;
    });
    return { receita: receita, despesa: despesa };
  }

  // ── Card glassmorphism ──
  function buildCard(icon, label, value, valueCls, cardCls, drillType) {
    var drillAttr  = drillType ? ' data-drill="' + drillType + '"' : '';
    var drillClass = drillType ? ' dash-card-drillable' : '';
    return '<div class="summary-card ' + cardCls + drillClass + '"' + drillAttr + '>' +
      '<div class="dash-card-watermark"><i class="ph-fill ' + icon + '"></i></div>' +
      '<div class="dash-card-top">' +
        '<div class="dash-card-icon-badge dash-badge-' + valueCls + '">' +
          '<i class="ph-fill ' + icon + '"></i>' +
        '</div>' +
        (drillType ? '<span class="dash-card-drill-hint"><i class="ph ph-magnifying-glass"></i> Ver detalhes</span>' : '') +
      '</div>' +
      '<div class="card-label">' + label + '</div>' +
      '<div class="card-value ' + valueCls + '">' + fmtR(value) + '</div>' +
    '</div>';
  }

  // ── Render principal ──
  function render(respIds, visao, cartaoId, cat) {
    var mesNome = MESES_NOMES[AppState.mesIdx];
    var anoVal  = AppState.ano;

    // Resolve respIds → effRespId para funções legadas
    var allRespsCount = AppData.responsaveis.length;
    var isGeral  = !respIds || respIds.length === 0 || respIds.length >= allRespsCount;
    var isSingle = !isGeral && respIds.length === 1;
    var isMulti  = !isGeral && !isSingle;
    var effRespId = isGeral ? 'geral' : (isSingle ? String(respIds[0]) : null);

    var respLabel = isGeral ? 'Todos'
      : isSingle
        ? (AppData.responsaveis.find(function (r) { return String(r.id) === String(respIds[0]); }) || { nome: 'Resp' }).nome.split(' ')[0]
        : respIds.length + ' responsáveis';

    // Calcula dados conforme visão ativa
    var dados;
    if (!isMulti) {
      dados = visao === 'cartao'
        ? calcSummaryCartao(AppState.mesIdx, effRespId, cartaoId, cat)
        : visao === 'dre'
          ? calcSummaryDREOnly(AppState.mesIdx, effRespId)
          : calcSummaryDRE(AppState.mesIdx, effRespId, cat);
    } else {
      dados = { receita: 0, despesa: 0 };
      respIds.forEach(function (id) {
        var d = visao === 'cartao'
          ? calcSummaryCartao(AppState.mesIdx, String(id), cartaoId, cat)
          : visao === 'dre'
            ? calcSummaryDREOnly(AppState.mesIdx, String(id))
            : calcSummaryDRE(AppState.mesIdx, String(id), cat);
        dados.receita += d.receita;
        dados.despesa += d.despesa;
      });
    }
    var saldo = dados.receita - dados.despesa;

    // Gastos por cartão
    var gastosCartao;
    if (!isMulti) {
      gastosCartao = getGastoPorCartao(AppState.mesIdx, effRespId, cat, visao, cartaoId);
    } else {
      if (visao === 'dre') {
        gastosCartao = AppData.cartoes.map(function (c) { return { cartao: c, total: 0 }; });
      } else {
        var cartoesFiltroMulti = (visao === 'cartao' && cartaoId)
          ? AppData.cartoes.filter(function (c) { return c.id === parseInt(cartaoId); })
          : AppData.cartoes;
        gastosCartao = cartoesFiltroMulti.map(function (c) {
          var total = respIds.reduce(function (s, id) {
            var g = getGastoPorCartao(AppState.mesIdx, String(id), cat, visao, cartaoId)
                      .find(function (x) { return x.cartao.id === c.id; });
            return s + (g ? g.total : 0);
          }, 0);
          return { cartao: c, total: total };
        });
      }
    }
    var totalGeral = gastosCartao.reduce(function (s, g) { return s + g.total; }, 0);

    var cartaoCardsHTML = gastosCartao.length
      ? gastosCartao.map(function (g) {
          var cor = g.cartao.cor || '#6366f1';
          var pct = totalGeral > 0 ? Math.round((g.total / totalGeral) * 100) : 0;
          return '<div class="dash-cartao-card dash-cartao-card-click" data-cartao-id="' + g.cartao.id + '">' +
            '<div class="dash-cartao-main">' +
              '<div class="dash-cartao-icon" style="background:' + cor + '18;color:' + cor + '">' +
                '<i class="ph-fill ph-credit-card"></i>' +
              '</div>' +
              '<div class="dash-cartao-info">' +
                '<div class="dash-cartao-nome">' + g.cartao.nome + '</div>' +
                '<div class="dash-cartao-bandeira">' + (g.cartao.bandeira || 'Cartão') + '</div>' +
              '</div>' +
              '<div class="dash-cartao-total' + (g.total > 0 ? ' dash-cartao-total-val' : '') + '">' +
                (g.total > 0 ? fmtR(g.total) : '<span class="dash-cartao-zero">—</span>') +
              '</div>' +
            '</div>' +
            (g.total > 0
              ? '<div class="dash-cartao-bar-row">' +
                  '<div class="dash-cartao-bar-wrap">' +
                    '<div class="dash-cartao-bar-fill" style="width:' + pct + '%;background:' + cor + '"></div>' +
                  '</div>' +
                  '<span class="dash-cartao-pct" style="color:' + cor + '">' + pct + '%</span>' +
                '</div>'
              : '') +
          '</div>';
        }).join('')
      : '<p style="color:var(--color-muted);font-size:13px;padding:16px 20px;text-align:center">Nenhum cartão cadastrado.</p>';

    // Gastos por categoria
    var validCatMap = {};
    AppData.categorias.forEach(function (c) { validCatMap[c.nome] = c.cor; });
    var porCat = {};
    var mesNum = String(AppState.mesIdx + 1).padStart(2, '0');

    var respIntCat = (!isMulti && effRespId !== 'geral') ? parseInt(effRespId) : null;
    AppData.getLancamentos().forEach(function (l) {
      if (!validCatMap[l.cat]) return;
      if (l.data.split('/')[1] !== mesNum) return;
      if (l.tipo === 'receita') return;
      if (cat && cat.length > 0 && cat.indexOf(l.cat) === -1) return;
      if (visao === 'cartao') {
        if (!l.cartaoId) return;
        if (cartaoId && l.cartaoId !== parseInt(cartaoId)) return;
      }
      var valor = 0;
      if (isMulti) {
        if (l.isDividido && l.splits) {
          l.splits.forEach(function (s) {
            if (respIds.indexOf(s.respId) !== -1) valor += Math.abs(s.valor);
          });
        } else if (respIds.indexOf(l.responsavelId) !== -1) {
          valor = Math.abs(l.valor);
        }
      } else if (respIntCat !== null) {
        if (l.isDividido && l.splits) {
          var sp = l.splits.find(function (s) { return s.respId === respIntCat; });
          if (!sp) return;
          valor = Math.abs(sp.valor);
        } else if (l.responsavelId === respIntCat) {
          valor = Math.abs(l.valor);
        }
      } else {
        valor = Math.abs(l.valor);
      }
      if (valor > 0) porCat[l.cat] = (porCat[l.cat] || 0) + valor;
    });

    // Categorias disponíveis no mês (para o select)
    var catsDisp = [];
    AppData.getLancamentos().forEach(function (l) {
      if (l.data.split('/')[1] === mesNum && l.cat && catsDisp.indexOf(l.cat) === -1) catsDisp.push(l.cat);
    });
    catsDisp.sort();
    var catLabel = cat.length === 0 || cat.length === catsDisp.length
      ? 'Todas as categorias'
      : cat.length === 1 ? cat[0]
      : cat.length === 2 ? cat[0] + ', ' + cat[1]
      : cat.length + ' categorias selecionadas';
    var catEntries = Object.keys(porCat)
      .map(function (k) { return { nome: k, val: porCat[k], cor: validCatMap[k] }; })
      .sort(function (a, b) { return b.val - a.val; });
    var hasCatData = catEntries.length > 0;

    // Fluxo anual
    var totalAnoR = 0, totalAnoD = 0;
    var anoRowsHTML = MESES_NOMES.map(function (m, i) {
      var d = calcMesAnual(i);
      totalAnoR += d.receita;
      totalAnoD += d.despesa;
      var saldoM  = d.receita - d.despesa;
      var isAtual = i === AppState.mesIdx;
      var rowStyle = isAtual ? 'background:var(--color-primary-light)' : '';
      var atualTag = isAtual ? ' <span style="font-size:11px;background:var(--color-primary);color:#fff;border-radius:20px;padding:2px 8px">Selecionado</span>' : '';
      var saldoCls = saldoM > 0 ? 'amount-income' : (saldoM < 0 ? 'amount-expense' : '');
      var sinal    = saldoM > 0 ? '▲ ' : (saldoM < 0 ? '▼ ' : '');
      if (!d.receita && !d.despesa) {
        return '<tr style="' + rowStyle + '"><td><strong>' + m + '</strong>' + atualTag + '</td>' +
          '<td style="color:var(--color-muted)">—</td><td style="color:var(--color-muted)">—</td><td style="color:var(--color-muted)">—</td></tr>';
      }
      return '<tr style="' + rowStyle + '">' +
        '<td><strong>' + m + '</strong>' + atualTag + '</td>' +
        '<td class="amount-income">' + fmtR(d.receita) + '</td>' +
        '<td class="amount-expense">' + fmtR(d.despesa) + '</td>' +
        '<td class="' + saldoCls + '">' + sinal + fmtR(Math.abs(saldoM)) + '</td>' +
      '</tr>';
    }).join('');
    var saldoAno = totalAnoR - totalAnoD;

    // Opções de cartões para o filtro
    var cartaoOpts = '<option value="">Todos os cartões</option>' +
      AppData.cartoes.map(function (c) {
        return '<option value="' + c.id + '"' + (String(c.id) === String(cartaoId) ? ' selected' : '') + '>' + c.nome + '</option>';
      }).join('');

    // ── HTML ──
    container.innerHTML =
      // Cabeçalho
      '<div class="page-header" style="flex-wrap:wrap;gap:10px">' +
        '<h2>Dashboard</h2>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<button id="dash-resp-btn" class="dash-filtro-sel dash-cat-trigger" type="button">' + respLabel + ' ▾</button>' +
          '<button id="dash-cat-btn" class="dash-filtro-sel dash-cat-trigger" type="button">' + catLabel + ' ▾</button>' +
        '</div>' +
      '</div>' +

      // ── Filtro de visão ──
      '<div class="dash-visao-bar page-enter">' +
        '<div class="dash-visao-pills">' +
          '<button class="dash-visao-pill' + (visao === 'geral' ? ' active' : '') + '" data-visao="geral">' +
            '<i class="ph ph-squares-four"></i> Geral' +
          '</button>' +
          '<button class="dash-visao-pill' + (visao === 'cartao' ? ' active' : '') + '" data-visao="cartao">' +
            '<i class="ph ph-credit-card"></i> Apenas Cartão' +
          '</button>' +
          '<button class="dash-visao-pill' + (visao === 'dre' ? ' active' : '') + '" data-visao="dre">' +
            '<i class="ph ph-chart-bar"></i> Apenas DRE' +
          '</button>' +
        '</div>' +
        (visao === 'cartao'
          ? '<select id="dash-cartao-sel" class="dash-filtro-sel">' + cartaoOpts + '</select>'
          : '') +
      '</div>' +

      // ── 3 cards ──
      '<div class="summary-grid">' +
        buildCard('ph-scales',           'Saldo · ' + mesNome, saldo, saldo >= 0 ? 'income' : 'expense', saldo >= 0 ? 'dash-card-income' : 'dash-card-expense') +
        buildCard('ph-arrow-circle-up',  'Receitas · ' + mesNome, dados.receita, 'income',  'dash-card-income',  'receita') +
        buildCard('ph-arrow-circle-down', 'Despesas · ' + mesNome + (visao === 'cartao' ? ' (Cartão)' : visao === 'dre' ? ' (DRE)' : ''), dados.despesa, 'expense', 'dash-card-expense', 'despesa') +
      '</div>' +

      // ── Resumo de Cartões + Por Categoria ──
      '<div class="dash-mid-grid">' +
        '<div class="section-box">' +
          '<div class="section-box-header"><h2>Resumo de Cartões · ' + mesNome + '</h2></div>' +
          '<div class="dash-cartao-wrap"><div class="dash-cartao-grid">' + cartaoCardsHTML + '</div></div>' +
        '</div>' +
        '<div class="section-box">' +
          '<div class="section-box-header"><h2>Por Categoria</h2></div>' +
          (hasCatData
            ? '<div style="padding:12px 16px 16px"><canvas id="cat-pie-chart"></canvas></div>'
            : '<p style="color:var(--color-muted);font-size:13px;padding:20px 16px;text-align:center">Nenhum dado no período.</p>') +
        '</div>' +
      '</div>' +

      // ── Fluxo Anual ──
      '<div class="section-box">' +
        '<div class="section-box-header">' +
          '<h2>Fluxo Anual · ' + anoVal + '</h2>' +
          '<a href="#mes-a-mes" class="btn btn-outline" style="font-size:13px;padding:6px 14px">Ver DRE</a>' +
        '</div>' +
        '<table class="data-table zebra">' +
          '<thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead>' +
          '<tbody>' + anoRowsHTML + '</tbody>' +
          '<tfoot><tr style="background:#f4f6fb;border-top:2px solid var(--color-border)">' +
            '<td style="font-weight:700">Total ' + anoVal + '</td>' +
            '<td><strong class="amount-income">' + fmtR(totalAnoR) + '</strong></td>' +
            '<td><strong class="amount-expense">' + fmtR(totalAnoD) + '</strong></td>' +
            '<td><strong class="' + (saldoAno >= 0 ? 'amount-income' : 'amount-expense') + '">' +
              (saldoAno >= 0 ? '▲ ' : '▼ ') + fmtR(Math.abs(saldoAno)) +
            '</strong></td>' +
          '</tr></tfoot>' +
        '</table>' +
      '</div>';

    // ── Gráfico doughnut ──
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    var canvas = document.getElementById('cat-pie-chart');
    if (canvas && hasCatData) {
      pieChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels:   catEntries.map(function (e) { return e.nome; }),
          datasets: [{
            data:            catEntries.map(function (e) { return e.val; }),
            backgroundColor: catEntries.map(function (e) { return e.cor || '#6366f1'; }),
            borderWidth:     3,
            borderColor:     '#fff',
            hoverOffset:     6,
          }]
        },
        options: {
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 10, boxWidth: 12 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var val   = ctx.raw;
                  var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                  var pct   = total > 0 ? Math.round((val / total) * 100) : 0;
                  return ' ' + fmtR(val) + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    }

    // ── Filtro de responsável (multi-select) ──
    setupRespMultiSelect();

    // ── Filtro de categoria (multi-select) ──
    setupCatMultiSelect(catsDisp);

    // ── Pills de visão ──
    container.querySelectorAll('.dash-visao-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        _dashVisao    = this.dataset.visao;
        _dashCartaoId = '';
        render(_dashRespIds, _dashVisao, _dashCartaoId, _dashCat);
      });
    });

    // ── Filtro de cartão específico ──
    var selCartao = document.getElementById('dash-cartao-sel');
    if (selCartao) {
      selCartao.addEventListener('change', function () {
        _dashCartaoId = this.value;
        render(_dashRespIds, _dashVisao, _dashCartaoId, _dashCat);
      });
    }

    // ── Drill-down cards de resumo (receita / despesa) ──
    container.querySelector('.summary-grid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-drill]');
      if (!card) return;
      var tipo  = card.dataset.drill;
      var items;
      if (tipo === 'receita') {
        items = getDrillReceitas(AppState.mesIdx, effRespId || 'geral');
      } else if (_dashVisao === 'cartao') {
        items = isMulti
          ? respIds.reduce(function (acc, id) { return acc.concat(getDrillDespesasCartao(AppState.mesIdx, String(id), cartaoId, cat)); }, [])
          : getDrillDespesasCartao(AppState.mesIdx, effRespId, cartaoId, cat);
      } else if (_dashVisao === 'dre') {
        items = isMulti
          ? respIds.reduce(function (acc, id) { return acc.concat(getDrillDespesasDREOnly(AppState.mesIdx, String(id))); }, [])
          : getDrillDespesasDREOnly(AppState.mesIdx, effRespId);
      } else {
        items = isMulti
          ? respIds.reduce(function (acc, id) { return acc.concat(getDrillDespesasDRE(AppState.mesIdx, String(id), cat)); }, [])
          : getDrillDespesasDRE(AppState.mesIdx, effRespId, cat);
      }
      items.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
      var cartaoNome = cartaoId
        ? (AppData.cartoes.find(function (c) { return c.id === parseInt(cartaoId); }) || {}).nome || ''
        : '';
      var sufixo = _dashVisao === 'cartao'
        ? ' · Cartão' + (cartaoNome ? ' ' + cartaoNome : '')
        : _dashVisao === 'dre' ? ' · DRE' : '';
      var catSufixo = (cat && cat.length > 0) ? ' · ' + (cat.length === 1 ? cat[0] : cat.length + ' cats') : '';
      var titulo = (tipo === 'receita' ? 'Receitas' : 'Despesas') + ' · ' + mesNome + sufixo + catSufixo;
      openDrillModal(tipo, items, titulo);
    });

    // ── Drill-down cards de cartão ──
    var cartaoGrid = container.querySelector('.dash-cartao-grid');
    if (cartaoGrid) {
      cartaoGrid.addEventListener('click', function (e) {
        var card = e.target.closest('.dash-cartao-card-click');
        if (!card) return;
        var cId  = card.dataset.cartaoId;
        var cObj = AppData.cartoes.find(function (c) { return String(c.id) === cId; }) || {};
        var items;
        if (!isMulti) {
          items = getDrillDespesasCartao(AppState.mesIdx, effRespId, cId, cat);
        } else {
          items = respIds.reduce(function (acc, id) {
            return acc.concat(getDrillDespesasCartao(AppState.mesIdx, String(id), cId, cat));
          }, []);
          items.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
        }
        var catSufixo = (cat && cat.length > 0) ? ' · ' + (cat.length === 1 ? cat[0] : cat.length + ' cats') : '';
        openDrillModal('despesa', items, (cObj.nome || 'Cartão') + ' · ' + mesNome + catSufixo);
      });
    }
  }

  function setupCatMultiSelect(catsDisp) {
    var btn = document.getElementById('dash-cat-btn');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var existing = document.getElementById('dash-cat-panel');
      if (existing) { existing.remove(); return; }

      var panel = document.createElement('div');
      panel.id        = 'dash-cat-panel';
      panel.className = 'dash-cat-panel';
      var rect = btn.getBoundingClientRect();
      panel.style.cssText =
        'position:fixed;top:' + (rect.bottom + 6) + 'px;left:' + rect.left + 'px;' +
        'min-width:' + Math.max(rect.width, 210) + 'px;z-index:2000';

      var html =
        '<div class="dcp-actions">' +
          '<button class="dcp-action-btn" id="dcp-all">Selecionar todas</button>' +
          '<button class="dcp-action-btn" id="dcp-none">Limpar</button>' +
        '</div>';
      catsDisp.forEach(function (c) {
        var sel = _dashCat.length === 0 || _dashCat.indexOf(c) !== -1;
        var cEsc = c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        html += '<label class="dcp-item">' +
          '<input type="checkbox" value="' + cEsc + '"' + (sel ? ' checked' : '') + '>' +
          '<span>' + cEsc + '</span>' +
        '</label>';
      });
      panel.innerHTML = html;
      document.body.appendChild(panel);

      function applySelection() {
        var checked = Array.from(panel.querySelectorAll('input[type=checkbox]:checked'))
          .map(function (cb) { return cb.value; });
        _dashCat = checked.length === catsDisp.length ? [] : checked;
        var b = document.getElementById('dash-cat-btn');
        if (b) {
          var lbl = _dashCat.length === 0 ? 'Todas as categorias'
            : _dashCat.length === 1 ? _dashCat[0]
            : _dashCat.length === 2 ? _dashCat[0] + ', ' + _dashCat[1]
            : _dashCat.length + ' categorias selecionadas';
          b.textContent = lbl + ' ▾';
        }
        render(_dashRespIds, _dashVisao, _dashCartaoId, _dashCat);
      }

      panel.addEventListener('change', function (e) {
        if (e.target.type === 'checkbox') applySelection();
      });
      document.getElementById('dcp-all').addEventListener('click', function () {
        panel.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = true; });
        applySelection();
      });
      document.getElementById('dcp-none').addEventListener('click', function () {
        panel.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
        applySelection();
      });

      setTimeout(function () {
        function onOut(e) {
          if (!e.target.closest('#dash-cat-panel') && e.target.id !== 'dash-cat-btn') {
            var p = document.getElementById('dash-cat-panel');
            if (p) p.remove();
            document.removeEventListener('click', onOut);
          }
        }
        document.addEventListener('click', onOut);
      }, 0);
    });
  }

  function setupRespMultiSelect() {
    var btn = document.getElementById('dash-resp-btn');
    if (!btn) return;
    var resps = AppData.responsaveis;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var existing = document.getElementById('dash-resp-panel');
      if (existing) { existing.remove(); return; }

      var panel = document.createElement('div');
      panel.id        = 'dash-resp-panel';
      panel.className = 'dash-cat-panel';
      var rect = btn.getBoundingClientRect();
      panel.style.cssText =
        'position:fixed;top:' + (rect.bottom + 6) + 'px;left:' + rect.left + 'px;' +
        'min-width:' + Math.max(rect.width, 180) + 'px;z-index:2000';

      var html =
        '<div class="dcp-actions">' +
          '<button class="dcp-action-btn" id="drp-all">Marcar todos</button>' +
          '<button class="dcp-action-btn" id="drp-none">Nenhum</button>' +
        '</div>';
      resps.forEach(function (r) {
        var checked = _dashRespIds.length === 0 || _dashRespIds.indexOf(r.id) !== -1;
        html += '<label class="dcp-item">' +
          '<input type="checkbox" value="' + r.id + '"' + (checked ? ' checked' : '') + '>' +
          '<span>' + r.nome.split(' ')[0] + '</span>' +
        '</label>';
      });
      panel.innerHTML = html;
      document.body.appendChild(panel);

      function applyResp() {
        var checked = Array.from(panel.querySelectorAll('input:checked'))
          .map(function (cb) { return parseInt(cb.value); });
        _dashRespIds = checked.length >= resps.length ? [] : checked;
        var b = document.getElementById('dash-resp-btn');
        if (b) {
          var lbl = _dashRespIds.length === 0 ? 'Todos'
            : _dashRespIds.length === 1
              ? (resps.find(function (r) { return r.id === _dashRespIds[0]; }) || { nome: 'Resp' }).nome.split(' ')[0]
              : _dashRespIds.length + ' responsáveis';
          b.textContent = lbl + ' ▾';
        }
        render(_dashRespIds, _dashVisao, _dashCartaoId, _dashCat);
      }

      panel.addEventListener('change', function (e) {
        if (e.target.type === 'checkbox') applyResp();
      });
      document.getElementById('drp-all').addEventListener('click', function () {
        panel.querySelectorAll('input').forEach(function (cb) { cb.checked = true; });
        applyResp();
      });
      document.getElementById('drp-none').addEventListener('click', function () {
        panel.querySelectorAll('input').forEach(function (cb) { cb.checked = false; });
        applyResp();
      });

      setTimeout(function () {
        function onOut(e) {
          if (!e.target.closest('#dash-resp-panel') && e.target.id !== 'dash-resp-btn') {
            var p = document.getElementById('dash-resp-panel');
            if (p) p.remove();
            document.removeEventListener('click', onOut);
          }
        }
        document.addEventListener('click', onOut);
      }, 0);
    });
  }

  render(_dashRespIds, _dashVisao, _dashCartaoId, _dashCat);
});
