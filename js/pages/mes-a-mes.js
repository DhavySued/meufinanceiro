Router.register('mes-a-mes', function (container) {

  var MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  var mesAtualIdx = AppState.mesIdx;
  var tabAtiva    = null;

  function makeButtons(attrs) {
    return '<span class="row-actions">' +
      '<button class="btn-edit-row row-btn row-btn-edit" ' + attrs + ' title="Editar"><i class="ph ph-pencil-simple" style="pointer-events:none"></i></button>' +
      '<button class="btn-del-row row-btn row-btn-del" '  + attrs + ' title="Remover"><i class="ph ph-trash" style="pointer-events:none"></i></button>' +
    '</span>';
  }

  function fmtR(v) {
    return v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
  }

  function soma(arr) { return arr.reduce(function (s, x) { return s + x.valor; }, 0); }

  // ── Despesas de cartão reais (lançamentos) filtradas por responsável e mês ──
  function getDespCartaoResp(mesIdx, respId) {
    var mesNum = String(mesIdx + 1).padStart(2, '0');
    return AppData.getCartoesFluxo().map(function (c) {
      var lancs = AppData.getLancamentos().filter(function (l) {
        if (l.cartaoId !== c.id) return false;
        if (l.data.split('/')[1] !== mesNum) return false;
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
      // total positivo = dívida líquida; negativo = crédito líquido
      var concilCount = lancs.filter(function (l) { return l.conciliado; }).length;
      return {
        desc:    'Cartão ' + c.nome,
        valor:   Math.max(0, total), // dívida líquida positiva para a DRE
        quinzena: 2,
        locked:  true,
        cor:     c.cor || null,
        concilCount: concilCount,
        totalLancs:  lancs.length,
        todoConcil:  lancs.length > 0 && concilCount === lancs.length,
        ckKey:   'c_' + c.id,
      };
    });
  }

  // ── Modal de adicionar gasto ──
  function criarModalGasto() {
    var ant = document.getElementById('modal-add-gasto');
    if (ant) ant.remove();
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-add-gasto';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Adicionar Gasto</h3>' +
          '<button class="modal-close" id="btn-fechar-gasto">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="gasto-desc" placeholder="Ex: Conta de Luz" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Valor (R$)</label>' +
            '<input type="number" id="gasto-valor" placeholder="0,00" min="0" step="0.01" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Quinzena</label>' +
            '<select id="gasto-qz">' +
              '<option value="1">1ª Quinzena (dias 01–15)</option>' +
              '<option value="2">2ª Quinzena (dias 16–31)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-gasto">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-gasto">Adicionar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    return m;
  }

  // ── Estrutura fixa da página (renderizada uma vez) ──
  function renderPagina() {
    var resps = AppData.getFluxoCaixa();
    if (!tabAtiva && resps.length) tabAtiva = resps[0].id;

    container.innerHTML =
      '<div class="page-header" style="flex-wrap:wrap;gap:10px">' +
        '<h2>DRE · Mês a Mês por Quinzena</h2>' +
        '<select id="dre-mes-sel" style="padding:7px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface)">' +
          MESES_NOMES.map(function (m, i) {
            return '<option value="' + i + '"' + (i === mesAtualIdx ? ' selected' : '') + '>' + m + ' 2026</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="dre-chips-bar" id="dre-tabs">' +
        resps.map(function (r) {
          return '<button class="dre-chip' + (r.id === tabAtiva ? ' dre-chip-ativa' : '') + '" data-resp-id="' + r.id + '">' +
            '<i class="ph ph-user-circle" style="font-size:15px;pointer-events:none"></i>' +
            r.nome +
          '</button>';
        }).join('') +
      '</div>' +

      '<div id="dre-content"></div>';

    document.getElementById('dre-mes-sel').addEventListener('change', function () {
      mesAtualIdx = parseInt(this.value);
      AppState.set(mesAtualIdx, AppState.ano);
      renderConteudo();
    });

    document.getElementById('dre-tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.dre-chip');
      if (!tab) return;
      tabAtiva = parseInt(tab.dataset.respId);
      document.querySelectorAll('.dre-chip').forEach(function (t) {
        t.classList.toggle('dre-chip-ativa', parseInt(t.dataset.respId) === tabAtiva);
      });
      renderConteudo();
    });

    renderConteudo();
  }

  function renderConteudo() {
    var resp = AppData.getById(tabAtiva);
    if (!resp) {
      document.getElementById('dre-content').innerHTML =
        '<div class="section-box" style="padding:40px;text-align:center;color:var(--color-muted)">Nenhum responsável cadastrado.</div>';
      return;
    }
    renderDRE(mesAtualIdx, resp);
  }

  // ── DRE por quinzena ──
  function renderDRE(mesIdx, resp) {
    var mesNome = MESES_NOMES[mesIdx] + ' 2026';
    var respId  = resp.id;
    var mesKey  = '2026-' + String(mesIdx + 1).padStart(2, '0');

    function getReceitasQz() {
      var src = ((resp.ganhos_mes || {})[mesKey]) || (resp.ganhos || []);
      var ganhos = src
        .filter(function (g) { return !g.ate || mesKey <= g.ate; })
        .map(function (g, i) {
          return { desc: g.desc, valor: g.valor, dia: g.dia || 1, isReceita: true, gIdx: i, ckKey: 'r_' + i };
        });
      return {
        q1: ganhos.filter(function (g) { return g.dia <= 15; }),
        q2: ganhos.filter(function (g) { return g.dia > 15; })
      };
    }

    var modalGasto   = criarModalGasto();
    var qzPendente   = 1;

    // ── Check de conclusão por linha (Supabase) ──
    function isChecked(ckKey) { return AppData.isDreChecked(respId, mesIdx, ckKey); }
    async function toggleCheck(ckKey) { return await AppData.toggleDreCheck(respId, mesIdx, ckKey); }

    function abrirModalGasto(qz) {
      qzPendente = qz;
      document.getElementById('gasto-desc').value  = '';
      document.getElementById('gasto-valor').value = '';
      document.getElementById('gasto-qz').value    = String(qz);
      modalGasto.classList.add('open');
    }

    function fecharModalGasto() { modalGasto.classList.remove('open'); }

    document.getElementById('btn-fechar-gasto').addEventListener('click', fecharModalGasto);
    document.getElementById('btn-cancelar-gasto').addEventListener('click', fecharModalGasto);
    modalGasto.addEventListener('click', function (e) { if (e.target === modalGasto) fecharModalGasto(); });

    document.getElementById('btn-salvar-gasto').addEventListener('click', async function () {
      var desc  = document.getElementById('gasto-desc').value.trim();
      var valor = parseFloat(document.getElementById('gasto-valor').value);
      var qz    = parseInt(document.getElementById('gasto-qz').value);
      if (!desc || isNaN(valor) || valor <= 0) { alert('Preencha a descrição e o valor.'); return; }
      try {
        await AppData.addDespesaManual({ mesIdx: mesIdx, respId: respId, quinzena: qz, desc: desc, valor: valor });
        fecharModalGasto();
        render();
      } catch (err) {
        console.error('[addDespesaManual] erro:', err);
        alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
      }
    });

    // Gasto real de uma categoria no mês (inclui lançamentos divididos)
    function gastoCategoriaMes(catNome) {
      var mesNum = String(mesIdx + 1).padStart(2, '0');
      var net = AppData.getLancamentos()
        .filter(function (l) {
          if (l.cat !== catNome || l.data.split('/')[1] !== mesNum) return false;
          if (l.isDividido && l.splits) return l.splits.some(function (s) { return s.respId === respId; });
          return l.responsavelId === respId;
        })
        .reduce(function (s, l) {
          var v;
          if (l.isDividido && l.splits) {
            var sp = l.splits.find(function (x) { return x.respId === respId; });
            v = sp ? Math.abs(sp.valor) : 0;
          } else {
            v = Math.abs(l.valor);
          }
          return s + (l.tipo === 'receita' ? -v : v);
        }, 0);
      // net positivo = gasto líquido; retorna como positivo para comparação com orçamento
      return Math.max(0, net);
    }

    function buildDespQz() {
      var despQ1 = [], despQ2 = [];

      // 1. Cartões — sempre 2ª quinzena
      getDespCartaoResp(mesIdx, respId).forEach(function (d) { despQ2.push(d); });

      // 2. Orçamentos do responsável — abaixo dos cartões, 2ª quinzena
      (resp.orcamentos || []).forEach(function (m) {
        var gasto    = gastoCategoriaMes(m.catNome);
        var restante = m.limite - gasto;
        var excedeu  = gasto > m.limite;
        var excesso  = excedeu ? gasto - m.limite : 0;
        despQ2.push({
          desc: m.catNome,
          valor: excedeu ? 0 : restante,   // excedeu → não conta no total (exibição usa x.excesso); senão → saldo restante
          gasto: gasto,
          locked: true, isMeta: true, limite: m.limite, restante: restante, excedeu: excedeu, excesso: excesso,
          ckKey: 'o_' + m.catNome,
        });
      });

      // 3. Despesas fixas do responsável — quinzena configurada
      var despesasFixasDoMes = (((resp.despesas_fixas_mes || {})[mesKey]) || (resp.despesasFixas || []))
        .filter(function (d) { return !d.ate || mesKey <= d.ate; });
      despesasFixasDoMes.forEach(function (d, i) {
        var item = { desc: d.desc, valor: d.valor, locked: false, isFixed: true, fixIdx: i, ckKey: 'f_' + i };
        if (d.quinzena === 1) despQ1.push(item); else despQ2.push(item);
      });

      // 4. Gastos manuais adicionados na DRE
      AppData.getDespesasManuais(mesIdx, respId).forEach(function (d) {
        var item = { desc: d.desc, valor: d.valor, locked: false, id: d.id, ckKey: 'm_' + d.id };
        if (d.quinzena === 1) despQ1.push(item); else despQ2.push(item);
      });

      return { despQ1: despQ1, despQ2: despQ2 };
    }

    function ckBox(ckKey) {
      var chk = isChecked(ckKey);
      return '<input type="checkbox" class="dre-row-check" data-ck="' + ckKey + '"' +
        (chk ? ' checked' : '') +
        ' style="width:15px;height:15px;accent-color:#10b981;flex-shrink:0;cursor:pointer;margin:0 6px 0 0" />';
    }

    function doneTrStyle(ckKey) {
      return isChecked(ckKey) ? ' style="opacity:0.45"' : '';
    }

    function doneDescStyle(ckKey) {
      return isChecked(ckKey) ? ' style="text-decoration:line-through"' : '';
    }

    function itemRows(itens, cls) {
      if (!itens.length) {
        return '<tr><td colspan="2" class="dre-empty-row">Nenhum item</td></tr>';
      }

      return itens.map(function (x) {
        var ck = x.ckKey || '';
        if (x.isMeta) {
          var pct      = x.limite > 0 ? Math.min(Math.round((x.gasto / x.limite) * 100), 100) : 0;
          var corBarra = pct < 70 ? '#10b981' : pct < 90 ? '#f59e0b' : '#ef4444';
          var saldoTxt = x.excedeu
            ? '<span class="dre-meta-excedeu">⚠ excedeu ' + fmtR(x.excesso) + ' · limite ' + fmtR(x.limite) + '</span>'
            : '<span class="dre-meta-ok">resta ' + fmtR(x.restante) + '</span>';
          var tdInfo = '<td class="dre-td"' + (x.excedeu ? ' colspan="2"' : '') + '>' +
              ckBox(ck) +
              '<div class="dre-meta-info"' + doneDescStyle(ck) + '>' +
                '<i class="ph ph-lock-simple" style="opacity:0.35;font-size:11px" title="Orçamento provisionado"></i>' +
                '<span>' + x.desc + '</span>' +
                '<span class="dre-meta-gasto">gasto ' + fmtR(x.gasto) + '</span>' +
                saldoTxt +
              '</div>' +
              '<div class="dre-mini-bar"><div style="height:100%;width:' + pct + '%;background:' + corBarra + ';border-radius:3px"></div></div>' +
            '</td>';
          var tdValor = x.excedeu ? '' : '<td class="dre-td-val dre-td-val-top"><span class="' + cls + '">' + fmtR(x.restante) + '</span></td>';
          return '<tr class="dre-row dre-meta-row' + (x.excedeu ? ' dre-meta-excedida' : '') + '"' + doneTrStyle(ck) + '>' +
            tdInfo + tdValor +
          '</tr>';
        }
        if (x.isReceita) {
          return '<tr class="dre-row"' + doneTrStyle(ck) + '>' +
            '<td class="dre-td">' +
              ckBox(ck) +
              '<span' + doneDescStyle(ck) + '>' + x.desc + '</span>' +
            '</td>' +
            '<td class="dre-td-val">' +
              '<span class="' + cls + '">' + fmtR(x.valor) + '</span>' +
              makeButtons('data-type="receita" data-gidx="' + x.gIdx + '"') +
            '</td>' +
          '</tr>';
        }
        if (x.isFixed) {
          return '<tr class="dre-row"' + doneTrStyle(ck) + '>' +
            '<td class="dre-td">' +
              ckBox(ck) +
              '<span' + doneDescStyle(ck) + '>' +
                '<i class="ph ph-push-pin" style="margin-right:4px;font-size:11px;color:var(--color-muted)" title="Despesa fixa"></i>' + x.desc +
              '</span>' +
            '</td>' +
            '<td class="dre-td-val">' +
              '<span class="' + cls + '">' + fmtR(x.valor) + '</span>' +
              makeButtons('data-type="fixa" data-fixidx="' + x.fixIdx + '"') +
            '</td>' +
          '</tr>';
        }
        if (!x.locked) {
          return '<tr class="dre-row"' + doneTrStyle(ck) + '>' +
            '<td class="dre-td">' +
              ckBox(ck) +
              '<span' + doneDescStyle(ck) + '>' + x.desc + '</span>' +
            '</td>' +
            '<td class="dre-td-val">' +
              '<span class="' + cls + '">' + fmtR(x.valor) + '</span>' +
              makeButtons('data-type="despesa" data-id="' + x.id + '"') +
            '</td>' +
          '</tr>';
        }
        var concilBadge = x.totalLancs > 0
          ? '<span class="dre-concil-badge' + (x.todoConcil ? ' dre-concil-badge-full' : '') + '">' +
              x.concilCount + '/' + x.totalLancs + ' ✓' +
            '</span>'
          : '';
        var corBorda  = x.cor ? x.cor : '#6366f1';
        var corFundo  = x.cor ? x.cor + '12' : 'transparent';
        var trStyle = 'border-left:3px solid ' + corBorda + ';background:' + corFundo + (isChecked(ck) ? ';opacity:0.45' : '');
        return '<tr class="dre-row' + (x.todoConcil ? ' tr-conciliado' : '') + '" style="' + trStyle + '">' +
          '<td class="dre-td" style="padding-left:13px">' +
            ckBox(ck) +
            '<span' + doneDescStyle(ck) + '>' +
              '<span class="dre-cartao-dot" style="background:' + corBorda + '"></span>' +
              x.desc + concilBadge +
            '</span>' +
          '</td>' +
          '<td class="dre-td-val"><span class="' + cls + '">' + fmtR(x.valor) + '</span></td>' +
        '</tr>';
      }).join('');
    }

    function buildCatPanel() {
      var mesNum = String(mesIdx + 1).padStart(2, '0');
      var porCat = {};

      AppData.categorias.forEach(function (cat) { porCat[cat.nome] = 0; });

      AppData.getLancamentos().forEach(function (l) {
        if (!l.cartaoId) return;
        if (l.data.split('/')[1] !== mesNum) return;
        var valor = 0;
        if (l.isDividido && l.splits) {
          var sp = l.splits.find(function (s) { return s.respId === respId; });
          if (sp) valor = l.tipo === 'receita' ? -Math.abs(sp.valor) : Math.abs(sp.valor);
        } else if (l.responsavelId === respId) {
          valor = l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor);
        }
        if (valor !== 0) porCat[l.cat] = (porCat[l.cat] || 0) + valor;
      });

      var CORES  = ['#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6','#ef4444','#8b5cf6','#14b8a6','#f97316','#0ea5e9'];
      var cats   = Object.keys(porCat).filter(function (k) { return porCat[k] !== 0; })
                         .sort(function (a, b) { return Math.abs(porCat[b]) - Math.abs(porCat[a]); });
      var total  = cats.reduce(function (s, k) { return s + Math.abs(porCat[k]); }, 0);

      var linhas = cats.length
        ? cats.map(function (cat, i) {
            var net = porCat[cat];
            var pct = total > 0 ? Math.round((Math.abs(net) / total) * 100) : 0;
            var cor = CORES[i % CORES.length];
            var valTxt = net < 0
              ? '<span class="dre-cat-val" style="color:var(--color-expense)">-' + fmtR(-net) + '</span>'
              : '<span class="dre-cat-val" style="color:var(--color-income)">+' + fmtR(net) + '</span>';
            return '<div class="dre-cat-item">' +
              '<div class="dre-cat-row">' +
                '<span class="dre-cat-dot" style="background:' + cor + '"></span>' +
                '<span class="dre-cat-name">' + cat + '</span>' +
                '<span class="dre-cat-pct">' + pct + '%</span>' +
                valTxt +
              '</div>' +
              '<div class="dre-cat-bar-bg">' +
                '<div class="dre-cat-bar-fill" style="width:' + pct + '%;background:' + cor + '"></div>' +
              '</div>' +
            '</div>';
          }).join('')
        : '<p class="dre-cat-empty">Nenhum lançamento no mês.</p>';

      return '<div class="dre-cat-panel">' +
        '<div class="dre-cat-hdr">' +
          '<div class="dre-cat-title"><i class="ph ph-chart-pie" style="margin-right:6px"></i>Categorias</div>' +
          '<div class="dre-cat-total-val">' + fmtR(Math.abs(total)) + '</div>' +
          '<div class="dre-cat-subtitle">cartões · ' + MESES_NOMES[mesIdx] + '</div>' +
        '</div>' +
        '<div class="dre-cat-body">' + linhas + '</div>' +
      '</div>';
    }

    function buildQzTable(titulo, dias, qzNum, receitasArr, despArr, totalR, totalD, saldo) {
      var saldoPositivo = saldo >= 0;
      var sSinal = saldo > 0 ? '+' : (saldo < 0 ? '-' : '');
      var badgeClass = saldoPositivo ? 'dre-badge-pos' : 'dre-badge-neg';
      var resultClass = saldoPositivo ? 'dre-resultado-pos' : 'dre-resultado-neg';

      return '<div class="dre-qz-card">' +
        '<div class="dre-qz-hdr">' +
          '<div>' +
            '<span class="dre-qz-num">' + titulo + 'ª Quinzena</span>' +
            '<span class="dre-qz-dias">dias ' + dias + '</span>' +
          '</div>' +
          (saldo !== 0
            ? '<span class="dre-saldo-badge ' + badgeClass + '">' + sSinal + fmtR(Math.abs(saldo)) + '</span>'
            : '<span class="dre-saldo-badge dre-badge-zero">—</span>') +
        '</div>' +

        '<div class="dre-section-hdr dre-income-hdr">' +
          '<span class="dre-section-icon dre-section-icon-income"><i class="ph ph-trend-up"></i></span>' +
          '<span class="dre-section-label">Receitas</span>' +
          '<span class="dre-section-total dre-val-income">' + fmtR(totalR) + '</span>' +
        '</div>' +
        '<table class="dre-table"><tbody>' +
          itemRows(receitasArr, 'dre-val-income') +
        '</tbody></table>' +

        '<div class="dre-section-hdr dre-expense-hdr">' +
          '<span class="dre-section-icon dre-section-icon-expense"><i class="ph ph-trend-down"></i></span>' +
          '<span class="dre-section-label">Despesas</span>' +
          '<span class="dre-section-total dre-val-expense">' + fmtR(totalD) + '</span>' +
        '</div>' +
        '<table class="dre-table"><tbody>' +
          itemRows(despArr, 'dre-val-expense') +
          '<tr><td colspan="2" style="padding:8px 16px">' +
            '<button class="btn-add-desp dre-btn-add" data-qz="' + qzNum + '">+ Adicionar Gasto</button>' +
          '</td></tr>' +
        '</tbody></table>' +

        '<div class="dre-resultado ' + resultClass + '">' +
          '<span>Resultado da ' + titulo + 'ª Quinzena</span>' +
          '<strong>' + sSinal + fmtR(Math.abs(saldo)) + '</strong>' +
        '</div>' +
      '</div>';
    }

    function render() {
      var recs    = getReceitasQz();
      var receitasQ1 = recs.q1, receitasQ2 = recs.q2;
      var qzData  = buildDespQz();
      var despQ1  = qzData.despQ1, despQ2 = qzData.despQ2;
      var totalR1 = soma(receitasQ1), totalD1 = soma(despQ1), saldo1 = totalR1 - totalD1;
      var totalR2 = soma(receitasQ2), totalD2 = soma(despQ2), saldo2 = totalR2 - totalD2;
      var totalR  = totalR1 + totalR2, totalD = totalD1 + totalD2, saldoTotal = totalR - totalD;

      var el = document.getElementById('dre-content');

      el.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr 280px;gap:20px;margin-bottom:24px;align-items:start" class="quinzena-grid">' +
          buildQzTable('1', '01 a 15', 1, receitasQ1, despQ1, totalR1, totalD1, saldo1) +
          buildQzTable('2', '16 a 31', 2, receitasQ2, despQ2, totalR2, totalD2, saldo2) +
          buildCatPanel() +
        '</div>' +

        '<div class="section-box" style="margin-bottom:24px">' +
          '<div class="section-box-header"><h2>Resumo · ' + mesNome + ' · ' + resp.nome + '</h2></div>' +
          '<table class="data-table">' +
            '<thead><tr><th></th><th>1ª Quinzena</th><th>2ª Quinzena</th><th>Total do Mês</th></tr></thead>' +
            '<tbody>' +
              '<tr>' +
                '<td style="font-weight:600"><span style="color:#10b981;margin-right:6px">↑</span>Receitas</td>' +
                '<td class="amount-income">' + fmtR(totalR1) + '</td>' +
                '<td class="amount-income">' + fmtR(totalR2) + '</td>' +
                '<td><strong class="amount-income">' + fmtR(totalR) + '</strong></td>' +
              '</tr>' +
              '<tr>' +
                '<td style="font-weight:600"><span style="color:#ef4444;margin-right:6px">↓</span>Despesas</td>' +
                '<td class="amount-expense">' + fmtR(totalD1) + '</td>' +
                '<td class="amount-expense">' + fmtR(totalD2) + '</td>' +
                '<td><strong class="amount-expense">' + fmtR(totalD) + '</strong></td>' +
              '</tr>' +
              '<tr class="' + (saldoTotal >= 0 ? 'dre-resumo-pos' : 'dre-resumo-neg') + '">' +
                '<td style="font-weight:700">Resultado</td>' +
                '<td class="' + (saldo1 >= 0 ? 'amount-income' : 'amount-expense') + '">' + (saldo1 > 0 ? '+' : saldo1 < 0 ? '-' : '') + fmtR(Math.abs(saldo1)) + '</td>' +
                '<td class="' + (saldo2 >= 0 ? 'amount-income' : 'amount-expense') + '">' + (saldo2 > 0 ? '+' : saldo2 < 0 ? '-' : '') + fmtR(Math.abs(saldo2)) + '</td>' +
                '<td><strong class="' + (saldoTotal >= 0 ? 'amount-income' : 'amount-expense') + '">' + (saldoTotal > 0 ? '+' : saldoTotal < 0 ? '-' : '') + fmtR(Math.abs(saldoTotal)) + '</strong></td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
        '</div>';

      // Delegação de checkboxes de conclusão por linha
      el.onchange = async function (e) {
        var cb = e.target.closest('.dre-row-check');
        if (!cb) return;
        var anteriorChecked = !cb.checked; // estado antes do clique
        cb.disabled = true;
        try {
          await toggleCheck(cb.dataset.ck);
        } catch (err) {
          console.error('[dre-check] erro ao salvar:', err);
          cb.checked = anteriorChecked; // reverte visualmente
          cb.disabled = false;
          alert('Erro ao salvar marcação: ' + (err.message || JSON.stringify(err)));
          return;
        }
        cb.disabled = false;
        var tr = cb.closest('tr');
        if (!tr) return;
        var done = isChecked(cb.dataset.ck);
        tr.style.opacity = done ? '0.45' : '';
        // aplica/remove line-through no span de descrição
        tr.querySelectorAll('td.dre-td > span').forEach(function (s) {
          if (s.classList.contains('dre-row-check')) return;
          s.style.textDecoration = done ? 'line-through' : '';
        });
        tr.querySelectorAll('td.dre-td .dre-meta-info').forEach(function (s) {
          s.style.textDecoration = done ? 'line-through' : '';
        });
      };

      // Delegação de cliques no conteúdo da DRE
      el.onclick = async function (e) {
        var btnDel  = e.target.closest('.btn-del-row');
        var btnAdd  = e.target.closest('.btn-add-desp');
        var btnEdit = e.target.closest('.btn-edit-row');
        var btnSave = e.target.closest('.btn-ei-save');
        var btnCanc = e.target.closest('.btn-ei-cancel');

        if (btnDel) {
          if (btnDel.dataset.type === 'receita') {
            var gIdx = parseInt(btnDel.dataset.gidx);
            resp.ganhos.splice(gIdx, 1);
            await AppData.updateResponsavel(respId, { ganhos: resp.ganhos });
          } else if (btnDel.dataset.type === 'fixa') {
            var fixIdx = parseInt(btnDel.dataset.fixidx);
            resp.despesasFixas.splice(fixIdx, 1);
            await AppData.updateResponsavel(respId, { despesasFixas: resp.despesasFixas });
          } else {
            await AppData.removeDespesaManual(Number(btnDel.dataset.id));
          }
          render();
          return;
        }

        if (btnAdd) {
          abrirModalGasto(parseInt(btnAdd.dataset.qz));
          return;
        }

        if (btnSave) {
          var novoDesc = document.getElementById('ei-desc').value.trim();
          var novoVal  = parseFloat(document.getElementById('ei-val').value);
          if (!novoDesc || isNaN(novoVal) || novoVal <= 0) { alert('Preencha corretamente.'); return; }
          if (btnSave.dataset.type === 'receita') {
            var gIdx = parseInt(btnSave.dataset.gidx);
            var ganhosMes = JSON.parse(JSON.stringify(((resp.ganhos_mes || {})[mesKey]) || resp.ganhos || []));
            ganhosMes[gIdx].desc  = novoDesc;
            ganhosMes[gIdx].valor = novoVal;
            if (!resp.ganhos_mes) resp.ganhos_mes = {};
            resp.ganhos_mes[mesKey] = ganhosMes;
            await AppData.updateResponsavel(respId, { ganhos_mes: resp.ganhos_mes });
          } else if (btnSave.dataset.type === 'fixa') {
            var fixIdx = parseInt(btnSave.dataset.fixidx);
            var despesasMes = JSON.parse(JSON.stringify(((resp.despesas_fixas_mes || {})[mesKey]) || resp.despesasFixas || []));
            despesasMes[fixIdx].desc  = novoDesc;
            despesasMes[fixIdx].valor = novoVal;
            if (!resp.despesas_fixas_mes) resp.despesas_fixas_mes = {};
            resp.despesas_fixas_mes[mesKey] = despesasMes;
            await AppData.updateResponsavel(respId, { despesas_fixas_mes: resp.despesas_fixas_mes });
          } else {
            await AppData.updateDespesaManual(Number(btnSave.dataset.id), { desc: novoDesc, valor: novoVal });
          }
          render();
          return;
        }

        if (btnCanc) { render(); return; }

        if (btnEdit) {
          var type = btnEdit.dataset.type;
          var tr   = btnEdit.closest('tr');
          var desc, valor, saveAttrs;

          if (type === 'receita') {
            var gIdx = parseInt(btnEdit.dataset.gidx);
            var ganhosMesEdit = ((resp.ganhos_mes || {})[mesKey]) || resp.ganhos || [];
            desc  = ganhosMesEdit[gIdx].desc;
            valor = ganhosMesEdit[gIdx].valor;
            saveAttrs = 'data-type="receita" data-gidx="' + gIdx + '"';
          } else if (type === 'fixa') {
            var fixIdx = parseInt(btnEdit.dataset.fixidx);
            var despMesEdit = ((resp.despesas_fixas_mes || {})[mesKey]) || resp.despesasFixas || [];
            desc  = despMesEdit[fixIdx].desc;
            valor = despMesEdit[fixIdx].valor;
            saveAttrs = 'data-type="fixa" data-fixidx="' + fixIdx + '"';
          } else {
            var id   = Number(btnEdit.dataset.id);
            var desp = AppData.getDespesasManuais(mesIdx, respId).find(function (d) { return d.id === id; });
            if (!desp) return;
            desc  = desp.desc;
            valor = desp.valor;
            saveAttrs = 'data-type="despesa" data-id="' + id + '"';
          }

          tr.innerHTML =
            '<td style="padding:6px 12px 6px 16px">' +
              '<input id="ei-desc" type="text" value="' + desc.replace(/"/g, '&quot;') + '" ' +
                'style="width:100%;padding:5px 8px;border:1px solid var(--color-border);border-radius:6px;font-size:13px" />' +
            '</td>' +
            '<td style="padding:6px 8px;white-space:nowrap">' +
              '<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">' +
                '<input id="ei-val" type="number" value="' + valor + '" min="0" step="0.01" ' +
                  'style="width:100px;padding:5px 8px;border:1px solid var(--color-border);border-radius:6px;font-size:13px" />' +
                '<button class="btn-ei-save" ' + saveAttrs + ' style="background:var(--color-primary);color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;font-weight:600">✓</button>' +
                '<button class="btn-ei-cancel" style="background:#f3f4f6;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px">✗</button>' +
              '</div>' +
            '</td>';
        }
      };
    }

    render();
  }

  renderPagina();
});
