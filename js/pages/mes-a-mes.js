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
    var mesRef = String(AppState.ano) + '-' + String(mesIdx + 1).padStart(2, '0');
    return AppData.getCartoesFluxo().map(function (c) {
      var lancs = AppData.getLancamentos().filter(function (l) {
        if (l.cartaoId !== c.id) return false;
        if (AppData.getMesRef(l) !== mesRef) return false;
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
      var concilCount = lancs.filter(function (l) { return l.conciliado; }).length;
      return {
        desc:    'Cartão ' + c.nome,
        valor:   Math.max(0, total),
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

  // ── Modal de adicionar item (Conta a Receber ou Conta a Pagar) ──
  function criarModalItem() {
    var ant = document.getElementById('modal-add-item');
    if (ant) ant.remove();
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-add-item';
    m.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3 id="modal-item-titulo">Adicionar</h3>' +
          '<button class="modal-close" id="btn-fechar-item">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="item-desc" placeholder="Ex: Salário" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Valor (R$)</label>' +
            '<input type="number" id="item-valor" placeholder="0,00" min="0" step="0.01" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Quinzena</label>' +
            '<select id="item-qz">' +
              '<option value="1">1ª Quinzena (dias 01–15)</option>' +
              '<option value="2">2ª Quinzena (dias 16–31)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-item">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-item">Adicionar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    return m;
  }

  // ── Modal de replicar para próximo mês ──
  function criarModalReplicar() {
    var ant = document.getElementById('modal-replicar');
    if (ant) ant.remove();
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-replicar';
    m.innerHTML =
      '<div class="modal modal-wide">' +
        '<div class="modal-header">' +
          '<h3 id="replicar-titulo">Replicar para Próximo Mês</h3>' +
          '<button class="modal-close" id="btn-fechar-replicar">&times;</button>' +
        '</div>' +
        '<div class="modal-body" id="replicar-body" style="max-height:60vh;overflow-y:auto">' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-replicar">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-confirmar-replicar">Replicar Selecionados</button>' +
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
    var isNovoModelo = mesKey >= '2026-07';

    function getReceitasQz() {
      var src = isNovoModelo
        ? ((resp.ganhos_mes || {})[mesKey] || [])
        : (((resp.ganhos_mes || {})[mesKey]) || (resp.ganhos || []));
      var ganhos = (isNovoModelo
        ? src
        : src.filter(function (g) { return (!g.de || mesKey >= g.de) && (!g.ate || mesKey <= g.ate); })
      ).map(function (g, i) {
        return { desc: g.desc, valor: g.valor, dia: g.dia || 1, isReceita: true, gIdx: i, ckKey: 'r_' + i };
      });
      return {
        q1: ganhos.filter(function (g) { return g.dia <= 15; }),
        q2: ganhos.filter(function (g) { return g.dia > 15; })
      };
    }

    var modalItem     = criarModalItem();
    var modalReplicar = (isNovoModelo && mesIdx < 11) ? criarModalReplicar() : null;
    var itemTipo      = 'despesa';
    var qzPendente    = 1;

    // ── Check de conclusão por linha (Supabase) ──
    function isChecked(ckKey) { return AppData.isDreChecked(respId, mesIdx, ckKey); }
    async function toggleCheck(ckKey) { return await AppData.toggleDreCheck(respId, mesIdx, ckKey); }

    function abrirModalItem(tipo, qz) {
      itemTipo = tipo;
      qzPendente = qz;
      document.getElementById('modal-item-titulo').textContent =
        tipo === 'receita' ? 'Adicionar Conta a Receber' : 'Adicionar Conta a Pagar';
      document.getElementById('item-desc').value  = '';
      document.getElementById('item-valor').value = '';
      document.getElementById('item-qz').value    = String(qz);
      modalItem.classList.add('open');
    }

    function fecharModalItem() { modalItem.classList.remove('open'); }

    document.getElementById('btn-fechar-item').addEventListener('click', fecharModalItem);
    document.getElementById('btn-cancelar-item').addEventListener('click', fecharModalItem);
    modalItem.addEventListener('click', function (e) { if (e.target === modalItem) fecharModalItem(); });

    document.getElementById('btn-salvar-item').addEventListener('click', async function () {
      var desc  = document.getElementById('item-desc').value.trim();
      var valor = parseFloat(document.getElementById('item-valor').value);
      var qz    = parseInt(document.getElementById('item-qz').value);
      if (!desc || isNaN(valor) || valor <= 0) { alert('Preencha a descrição e o valor.'); return; }
      try {
        if (itemTipo === 'receita') {
          var ganhosM = JSON.parse(JSON.stringify((resp.ganhos_mes || {})[mesKey] || []));
          ganhosM.push({ desc: desc, valor: valor, dia: qz === 1 ? 5 : 20 });
          if (!resp.ganhos_mes) resp.ganhos_mes = {};
          resp.ganhos_mes[mesKey] = ganhosM;
          await AppData.updateResponsavel(respId, { ganhos_mes: resp.ganhos_mes });
        } else if (isNovoModelo) {
          var fixasM = JSON.parse(JSON.stringify((resp.despesas_fixas_mes || {})[mesKey] || []));
          fixasM.push({ desc: desc, valor: valor, quinzena: qz });
          if (!resp.despesas_fixas_mes) resp.despesas_fixas_mes = {};
          resp.despesas_fixas_mes[mesKey] = fixasM;
          await AppData.updateResponsavel(respId, { despesas_fixas_mes: resp.despesas_fixas_mes });
        } else {
          await AppData.addDespesaManual({ mesIdx: mesIdx, respId: respId, quinzena: qz, desc: desc, valor: valor });
        }
        fecharModalItem();
        render();
      } catch (err) {
        console.error('[addItem] erro:', err);
        alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
      }
    });

    // ── Modal de replicar ──
    if (modalReplicar) {
      var nextMesIdx = mesIdx + 1;
      var nextMesKey = '2026-' + String(nextMesIdx + 1).padStart(2, '0');
      var nextMesNome = MESES_NOMES[nextMesIdx];

      document.getElementById('replicar-titulo').textContent =
        'Replicar para ' + nextMesNome;

      function abrirModalReplicar() {
        var recAtual = (resp.ganhos_mes || {})[mesKey] || [];
        var fixAtual = (resp.despesas_fixas_mes || {})[mesKey] || [];
        var html = '';

        if (recAtual.length) {
          html += '<div class="form-section-subtitle" style="margin:4px 0 10px">Contas a Receber</div>';
          recAtual.forEach(function (g, i) {
            html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-border);cursor:pointer">' +
              '<input type="checkbox" class="rep-rec" data-idx="' + i + '" checked style="width:16px;height:16px;accent-color:var(--color-primary);flex-shrink:0" />' +
              '<span style="flex:1;font-size:13px">' + (g.desc || '—') + '</span>' +
              '<span style="color:var(--color-income);font-weight:600;font-size:13px">' + fmtR(g.valor) + '</span>' +
            '</label>';
          });
        }

        if (fixAtual.length) {
          html += '<div class="form-section-subtitle" style="margin:' + (recAtual.length ? '18px' : '4px') + ' 0 10px">Contas a Pagar</div>';
          fixAtual.forEach(function (d, i) {
            html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-border);cursor:pointer">' +
              '<input type="checkbox" class="rep-fix" data-idx="' + i + '" checked style="width:16px;height:16px;accent-color:var(--color-primary);flex-shrink:0" />' +
              '<span style="flex:1;font-size:13px">' + (d.desc || '—') + '</span>' +
              '<span style="color:var(--color-expense);font-weight:600;font-size:13px">' + fmtR(d.valor) + '</span>' +
            '</label>';
          });
        }

        if (!recAtual.length && !fixAtual.length) {
          html = '<p style="color:var(--color-muted);font-size:13px;text-align:center;padding:24px 0">Nenhum item para replicar neste mês.</p>';
        }

        document.getElementById('replicar-body').innerHTML = html;
        modalReplicar.classList.add('open');
      }

      function fecharModalReplicar() { modalReplicar.classList.remove('open'); }

      document.getElementById('btn-fechar-replicar').addEventListener('click', fecharModalReplicar);
      document.getElementById('btn-cancelar-replicar').addEventListener('click', fecharModalReplicar);
      modalReplicar.addEventListener('click', function (e) { if (e.target === modalReplicar) fecharModalReplicar(); });

      document.getElementById('btn-confirmar-replicar').addEventListener('click', async function () {
        var recAtual = (resp.ganhos_mes || {})[mesKey] || [];
        var fixAtual = (resp.despesas_fixas_mes || {})[mesKey] || [];

        var recSel = [];
        document.querySelectorAll('#replicar-body .rep-rec:checked').forEach(function (cb) {
          var g = recAtual[parseInt(cb.dataset.idx)];
          if (g) recSel.push(Object.assign({}, g));
        });

        var fixSel = [];
        document.querySelectorAll('#replicar-body .rep-fix:checked').forEach(function (cb) {
          var d = fixAtual[parseInt(cb.dataset.idx)];
          if (d) fixSel.push(Object.assign({}, d));
        });

        if (!recSel.length && !fixSel.length) {
          alert('Selecione ao menos um item para replicar.');
          return;
        }

        try {
          if (!resp.ganhos_mes) resp.ganhos_mes = {};
          if (!resp.despesas_fixas_mes) resp.despesas_fixas_mes = {};

          var nextGanhos = JSON.parse(JSON.stringify(resp.ganhos_mes[nextMesKey] || []));
          recSel.forEach(function (g) {
            if (!nextGanhos.some(function (x) { return x.desc === g.desc; })) nextGanhos.push(g);
          });
          resp.ganhos_mes[nextMesKey] = nextGanhos;

          var nextFixas = JSON.parse(JSON.stringify(resp.despesas_fixas_mes[nextMesKey] || []));
          fixSel.forEach(function (d) {
            if (!nextFixas.some(function (x) { return x.desc === d.desc; })) nextFixas.push(d);
          });
          resp.despesas_fixas_mes[nextMesKey] = nextFixas;

          await AppData.updateResponsavel(respId, {
            ganhos_mes: resp.ganhos_mes,
            despesas_fixas_mes: resp.despesas_fixas_mes
          });
          fecharModalReplicar();
          alert('Itens replicados para ' + nextMesNome + ' com sucesso!');
        } catch (err) {
          console.error('[replicar] erro:', err);
          alert('Erro ao replicar: ' + (err.message || JSON.stringify(err)));
        }
      });
    }

    // Gasto real de uma categoria no mês (inclui lançamentos divididos)
    function gastoCategoriaMes(catNome) {
      var net = AppData.getLancamentos()
        .filter(function (l) {
          if (l.cat !== catNome || AppData.getMesRef(l) !== mesKey) return false;
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
          valor: excedeu ? 0 : restante,
          gasto: gasto,
          locked: true, isMeta: true, limite: m.limite, restante: restante, excedeu: excedeu, excesso: excesso,
          ckKey: 'o_' + m.catNome,
        });
      });

      // 3. Contas a Pagar (fixas)
      var despesasFixasDoMes = isNovoModelo
        ? ((resp.despesas_fixas_mes || {})[mesKey] || [])
        : (((resp.despesas_fixas_mes || {})[mesKey]) || (resp.despesasFixas || []))
            .filter(function (d) { return (!d.de || mesKey >= d.de) && (!d.ate || mesKey <= d.ate); });

      despesasFixasDoMes.forEach(function (d, i) {
        var item = { desc: d.desc, valor: d.valor, locked: false, isFixed: true, fixIdx: i, ckKey: 'f_' + i };
        if (d.quinzena === 1) despQ1.push(item); else despQ2.push(item);
      });

      // 4. Gastos manuais
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
                '<i class="ph ph-push-pin" style="margin-right:4px;font-size:11px;color:var(--color-muted)" title="Conta a Pagar"></i>' + x.desc +
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
      var porCat = {};

      AppData.categorias.forEach(function (cat) { porCat[cat.nome] = 0; });

      AppData.getLancamentos().forEach(function (l) {
        if (!l.cartaoId) return;
        if (AppData.getMesRef(l) !== mesKey) return;
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

      var recAddBtn = isNovoModelo
        ? '<tr><td colspan="2" style="padding:8px 16px">' +
            '<button class="btn-add-rec dre-btn-add" data-qz="' + qzNum + '">+ Adicionar Conta a Receber</button>' +
          '</td></tr>'
        : '';

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
          '<span class="dre-section-label">Contas a Receber</span>' +
          '<span class="dre-section-total dre-val-income">' + fmtR(totalR) + '</span>' +
        '</div>' +
        '<table class="dre-table"><tbody>' +
          itemRows(receitasArr, 'dre-val-income') +
          recAddBtn +
        '</tbody></table>' +

        '<div class="dre-section-hdr dre-expense-hdr">' +
          '<span class="dre-section-icon dre-section-icon-expense"><i class="ph ph-trend-down"></i></span>' +
          '<span class="dre-section-label">Contas a Pagar</span>' +
          '<span class="dre-section-total dre-val-expense">' + fmtR(totalD) + '</span>' +
        '</div>' +
        '<table class="dre-table"><tbody>' +
          itemRows(despArr, 'dre-val-expense') +
          '<tr><td colspan="2" style="padding:8px 16px">' +
            '<button class="btn-add-desp dre-btn-add" data-qz="' + qzNum + '">+ Adicionar Conta a Pagar</button>' +
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

      var replicarBtn = (isNovoModelo && mesIdx < 11)
        ? '<button class="btn btn-outline" id="btn-abrir-replicar" style="font-size:13px;gap:6px">' +
            '<i class="ph ph-copy" style="margin-right:4px"></i>Replicar para ' + MESES_NOMES[mesIdx + 1] +
          '</button>'
        : '';

      var el = document.getElementById('dre-content');

      el.innerHTML =
        (replicarBtn ? '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' + replicarBtn + '</div>' : '') +
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
                '<td style="font-weight:600"><span style="color:#10b981;margin-right:6px">↑</span>Contas a Receber</td>' +
                '<td class="amount-income">' + fmtR(totalR1) + '</td>' +
                '<td class="amount-income">' + fmtR(totalR2) + '</td>' +
                '<td><strong class="amount-income">' + fmtR(totalR) + '</strong></td>' +
              '</tr>' +
              '<tr>' +
                '<td style="font-weight:600"><span style="color:#ef4444;margin-right:6px">↓</span>Contas a Pagar</td>' +
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

      if (replicarBtn) {
        document.getElementById('btn-abrir-replicar').addEventListener('click', abrirModalReplicar);
      }

      // Delegação de checkboxes de conclusão por linha
      el.onchange = async function (e) {
        var cb = e.target.closest('.dre-row-check');
        if (!cb) return;
        var anteriorChecked = !cb.checked;
        cb.disabled = true;
        try {
          await toggleCheck(cb.dataset.ck);
        } catch (err) {
          console.error('[dre-check] erro ao salvar:', err);
          cb.checked = anteriorChecked;
          cb.disabled = false;
          alert('Erro ao salvar marcação: ' + (err.message || JSON.stringify(err)));
          return;
        }
        cb.disabled = false;
        var tr = cb.closest('tr');
        if (!tr) return;
        var done = isChecked(cb.dataset.ck);
        tr.style.opacity = done ? '0.45' : '';
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
        var btnAddDesp = e.target.closest('.btn-add-desp');
        var btnAddRec  = e.target.closest('.btn-add-rec');
        var btnEdit = e.target.closest('.btn-edit-row');
        var btnSave = e.target.closest('.btn-ei-save');
        var btnCanc = e.target.closest('.btn-ei-cancel');

        if (btnDel) {
          if (btnDel.dataset.type === 'receita') {
            var gIdx = parseInt(btnDel.dataset.gidx);
            if (isNovoModelo) {
              var ganhosM = JSON.parse(JSON.stringify((resp.ganhos_mes || {})[mesKey] || []));
              ganhosM.splice(gIdx, 1);
              if (!resp.ganhos_mes) resp.ganhos_mes = {};
              resp.ganhos_mes[mesKey] = ganhosM;
              await AppData.updateResponsavel(respId, { ganhos_mes: resp.ganhos_mes });
            } else {
              resp.ganhos.splice(gIdx, 1);
              await AppData.updateResponsavel(respId, { ganhos: resp.ganhos });
            }
          } else if (btnDel.dataset.type === 'fixa') {
            var fixIdx = parseInt(btnDel.dataset.fixidx);
            if (isNovoModelo) {
              var fixasM = JSON.parse(JSON.stringify((resp.despesas_fixas_mes || {})[mesKey] || []));
              fixasM.splice(fixIdx, 1);
              if (!resp.despesas_fixas_mes) resp.despesas_fixas_mes = {};
              resp.despesas_fixas_mes[mesKey] = fixasM;
              await AppData.updateResponsavel(respId, { despesas_fixas_mes: resp.despesas_fixas_mes });
            } else {
              resp.despesasFixas.splice(fixIdx, 1);
              await AppData.updateResponsavel(respId, { despesasFixas: resp.despesasFixas });
            }
          } else {
            await AppData.removeDespesaManual(Number(btnDel.dataset.id));
          }
          render();
          return;
        }

        if (btnAddDesp) {
          abrirModalItem('despesa', parseInt(btnAddDesp.dataset.qz));
          return;
        }

        if (btnAddRec) {
          abrirModalItem('receita', parseInt(btnAddRec.dataset.qz));
          return;
        }

        if (btnSave) {
          var novoDesc = document.getElementById('ei-desc').value.trim();
          var novoVal  = parseFloat(document.getElementById('ei-val').value);
          if (!novoDesc || isNaN(novoVal) || novoVal <= 0) { alert('Preencha corretamente.'); return; }
          if (btnSave.dataset.type === 'receita') {
            var gIdx = parseInt(btnSave.dataset.gidx);
            var ganhosMes = JSON.parse(JSON.stringify(((resp.ganhos_mes || {})[mesKey]) || (isNovoModelo ? [] : (resp.ganhos || []))));
            ganhosMes[gIdx].desc  = novoDesc;
            ganhosMes[gIdx].valor = novoVal;
            if (!resp.ganhos_mes) resp.ganhos_mes = {};
            resp.ganhos_mes[mesKey] = ganhosMes;
            await AppData.updateResponsavel(respId, { ganhos_mes: resp.ganhos_mes });
          } else if (btnSave.dataset.type === 'fixa') {
            var fixIdx = parseInt(btnSave.dataset.fixidx);
            var despesasMes = JSON.parse(JSON.stringify(((resp.despesas_fixas_mes || {})[mesKey]) || (isNovoModelo ? [] : (resp.despesasFixas || []))));
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
            var ganhosMesEdit = ((resp.ganhos_mes || {})[mesKey]) || (isNovoModelo ? [] : (resp.ganhos || []));
            desc  = ganhosMesEdit[gIdx].desc;
            valor = ganhosMesEdit[gIdx].valor;
            saveAttrs = 'data-type="receita" data-gidx="' + gIdx + '"';
          } else if (type === 'fixa') {
            var fixIdx = parseInt(btnEdit.dataset.fixidx);
            var despMesEdit = ((resp.despesas_fixas_mes || {})[mesKey]) || (isNovoModelo ? [] : (resp.despesasFixas || []));
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
