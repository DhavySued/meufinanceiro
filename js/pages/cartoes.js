Router.register('cartoes', function (container) {

  var CLASSES     = ['blue', 'dark', 'green'];
  var MESES_NOMES_LISTA = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                           'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var MESES_KEYS_LISTA  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var mesListaIdx = AppState.mesIdx;

  // ── Logos de bancos brasileiros ──────────────────────────
  // bg = cor principal, bg2 = cor do gradiente (fim), color = cor do texto no card
  var BANCOS_LOGOS = [
    { keys: ['nubank','nu bank'],            abbr: 'nu',    bg: '#8A05BE', bg2: '#6503A0', color: '#fff'     },
    { keys: ['caixa'],                       abbr: 'CEF',   bg: '#00509d', bg2: '#003B78', color: '#fff'     },
    { keys: ['c6'],                          abbr: 'C6',    bg: '#212121', bg2: '#3a3a3a', color: '#D4AF37'  },
    { keys: ['itaú','itau'],                 abbr: 'itaú',  bg: '#EC7000', bg2: '#C05800', color: '#fff'     },
    { keys: ['bradesco'],                    abbr: 'B',     bg: '#CC092F', bg2: '#A0001E', color: '#fff'     },
    { keys: ['santander'],                   abbr: 'San',   bg: '#EC0000', bg2: '#B80000', color: '#fff'     },
    { keys: ['inter'],                       abbr: 'inter', bg: '#FF7A00', bg2: '#CC5E00', color: '#fff'     },
    { keys: ['btg'],                         abbr: 'BTG',   bg: '#002868', bg2: '#001540', color: '#fff'     },
    { keys: ['xp ','xp'],                   abbr: 'XP',    bg: '#000000', bg2: '#1a1a1a', color: '#fff'     },
    { keys: ['picpay'],                      abbr: 'PP',    bg: '#21C25E', bg2: '#169046', color: '#fff'     },
    { keys: ['neon'],                        abbr: 'neon',  bg: '#3C3BCC', bg2: '#2929A0', color: '#00E5FF'  },
    { keys: ['banco do brasil','bb '],       abbr: 'BB',    bg: '#F6D001', bg2: '#DDB800', color: '#003882'  },
    { keys: ['mercado pago','mercadopago'],  abbr: 'MP',    bg: '#009EE3', bg2: '#007AB5', color: '#fff'     },
    { keys: ['sicoob'],                      abbr: 'Sic',   bg: '#00612E', bg2: '#004420', color: '#fff'     },
    { keys: ['sicredi'],                     abbr: 'Scr',   bg: '#009C3B', bg2: '#00782D', color: '#fff'     },
    { keys: ['original'],                    abbr: 'Ori',   bg: '#00856F', bg2: '#006054', color: '#fff'     },
    { keys: ['next'],                        abbr: 'nxt',   bg: '#00CF82', bg2: '#009E62', color: '#1a1a1a'  },
    { keys: ['will bank','willbank'],        abbr: 'will',  bg: '#00A3E0', bg2: '#007DB0', color: '#fff'     },
    { keys: ['digio'],                       abbr: 'dig',   bg: '#0046D5', bg2: '#0034A0', color: '#fff'     },
    { keys: ['sofisa'],                      abbr: 'Sof',   bg: '#004F9F', bg2: '#003A78', color: '#fff'     },
    { keys: ['modal'],                       abbr: 'Mdl',   bg: '#FF4F00', bg2: '#CC3D00', color: '#fff'     },
  ];

  // Retorna cor clara (#ffffff) ou escura (#1a1a1a) baseada na luminância do hex
  function getContrastColor(hex) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
  }

  // Escurece um hex por amount (0–255)
  function darkenHex(hex, amount) {
    var r = Math.max(0, parseInt(hex.slice(1,3), 16) - amount);
    var g = Math.max(0, parseInt(hex.slice(3,5), 16) - amount);
    var b = Math.max(0, parseInt(hex.slice(5,7), 16) - amount);
    return '#' + ('0'+r.toString(16)).slice(-2) + ('0'+g.toString(16)).slice(-2) + ('0'+b.toString(16)).slice(-2);
  }

  // Retorna o objeto banco ou null
  function getBancoInfo(nome) {
    var n = (nome || '').toLowerCase();
    for (var i = 0; i < BANCOS_LOGOS.length; i++) {
      var entry = BANCOS_LOGOS[i];
      for (var j = 0; j < entry.keys.length; j++) {
        if (n.indexOf(entry.keys[j]) !== -1) return entry;
      }
    }
    return null;
  }

  // Retorna o estilo visual completo para o card
  // cor: valor da coluna `cor` do Supabase (prioridade); nome: fallback pelo mapeamento
  function getBancoCardStyle(cor, nome) {
    var bg, bg2, textColor;

    if (cor && cor.charAt(0) === '#') {
      // Cor definida pelo usuário no cadastro
      bg        = cor;
      bg2       = darkenHex(cor, 28);
      textColor = getContrastColor(cor);
    } else {
      // Fallback: mapeamento por nome do banco
      var banco = getBancoInfo(nome);
      if (!banco) {
        return { gradient: 'linear-gradient(135deg,#374151 0%,#1f2937 100%)', textColor: '#fff', progressColor: 'rgba(255,255,255,0.9)' };
      }
      bg        = banco.bg;
      bg2       = banco.bg2 || banco.bg;
      textColor = banco.color;
    }

    var isLight = textColor !== '#ffffff' && textColor !== '#fff';
    return {
      gradient:      'linear-gradient(135deg,' + bg + ' 0%,' + bg2 + ' 100%)',
      textColor:     textColor,
      progressColor: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)'
    };
  }

  function getBancoLogoHTML(nome, cardTextColor) {
    var banco = getBancoInfo(nome);
    var textColor = cardTextColor || '#fff';
    if (!banco) {
      var words    = nome.trim().split(/\s+/);
      var initials = words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
      var logoBg   = textColor === '#fff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)';
      return '<div style="height:32px;min-width:36px;padding:0 8px;border-radius:8px;' +
             'background:' + logoBg + ';display:inline-flex;align-items:center;' +
             'justify-content:center;font-size:14px;font-weight:900;color:' + textColor + ';letter-spacing:-0.5px">' +
             initials + '</div>';
    }
    var logoBg = banco.color === '#fff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
    return '<div style="height:32px;min-width:36px;padding:0 10px;border-radius:8px;background:' + logoBg + ';' +
           'display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;' +
           'color:' + banco.color + ';letter-spacing:-0.3px;box-shadow:0 1px 4px rgba(0,0,0,0.2)">' +
           banco.abbr + '</div>';
  }

  // ── Logos das bandeiras ──────────────────────────────────
  function getBandeiraHTML(bandeira) {
    var b = (bandeira || '').toLowerCase().trim();
    if (b === 'mastercard') {
      return '<svg width="46" height="30" viewBox="0 0 46 30" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<circle cx="16" cy="15" r="13" fill="#EB001B"/>' +
        '<circle cx="30" cy="15" r="13" fill="#F79E1B" opacity="0.9"/>' +
        '</svg>';
    }
    if (b === 'visa') {
      return '<svg width="58" height="22" viewBox="0 0 58 22" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<text x="0" y="20" font-family="Arial Black,Arial,sans-serif" font-size="22" font-weight="900" ' +
        'font-style="italic" fill="white" letter-spacing="-0.5">VISA</text>' +
        '</svg>';
    }
    if (b === 'elo') {
      return '<svg width="44" height="22" viewBox="0 0 44 22" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<text x="0" y="20" font-family="Arial Black,Arial,sans-serif" font-size="21" font-weight="900" ' +
        'fill="white">elo</text>' +
        '</svg>';
    }
    if (b === 'amex') {
      return '<svg width="54" height="18" viewBox="0 0 54 18" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<text x="0" y="15" font-family="Arial,sans-serif" font-size="13" font-weight="800" ' +
        'fill="white" letter-spacing="2">AMEX</text>' +
        '</svg>';
    }
    if (b === 'hipercard') {
      return '<svg width="48" height="18" viewBox="0 0 48 18" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<text x="0" y="15" font-family="Arial,sans-serif" font-size="12" font-weight="800" fill="white" letter-spacing="1">hiper</text>' +
        '</svg>';
    }
    // fallback
    return '<span style="font-size:13px;font-weight:700;opacity:0.85">' + (bandeira || '') + '</span>';
  }

  function fmtR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ── Lista principal ──
  function renderLista() {
    var cartoes = AppData.cartoes;
    var mesKey  = MESES_KEYS_LISTA[mesListaIdx];

    if (!cartoes.length) {
      container.innerHTML =
        '<div class="page-header"><h2>Meus Cartões</h2>' +
          '<a href="#cad-cartoes" class="btn btn-primary">+ Cadastrar Cartão</a>' +
        '</div>' +
        '<div class="section-box" style="padding:40px;text-align:center;color:var(--color-muted)">' +
          '<div style="font-size:48px;margin-bottom:12px;color:var(--color-primary)"><i class="ph ph-credit-card"></i></div>' +
          '<p style="font-size:15px">Nenhum cartão cadastrado ainda.</p>' +
          '<a href="#cad-cartoes" class="btn btn-outline" style="margin-top:16px;display:inline-flex">Ir para Cadastro de Cartões</a>' +
        '</div>';
      return;
    }

    var cartoesHTML = cartoes.map(function (c) {
      var usado     = AppData.getTotalCartaoMes(c.id, mesListaIdx);
      var cardStyle = getBancoCardStyle(c.cor, c.nome);

      return '<div class="credit-card" data-id="' + c.id + '" title="Clique para ver os lançamentos"' +
             ' style="cursor:pointer;background:' + cardStyle.gradient + ';color:' + cardStyle.textColor + '">' +
        '<div class="card-gloss"></div>' +
        '<div class="card-top">' +
          '<div>' + getBancoLogoHTML(c.nome, cardStyle.textColor) + '</div>' +
          '<div>' + getBandeiraHTML(c.bandeira) + '</div>' +
        '</div>' +
        '<div class="card-name" style="margin:10px 0 0">' + c.nome + '</div>' +
        '<div class="card-number">•••• •••• •••• ••••</div>' +
        '<div class="card-bottom">' +
          '<div class="card-limit-label">Fatura atual</div>' +
          '<div class="card-amounts">' +
            '<span style="font-size:18px;font-weight:700">' + fmtR(usado) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var resumoHTML = cartoes.map(function (c) {
      var usado = AppData.getTotalCartaoMes(c.id, mesListaIdx);
      return '<tr>' +
        '<td><strong>' + c.nome + '</strong><br><span style="font-size:12px;color:var(--color-muted)">' + c.bandeira + '</span></td>' +
        '<td class="amount-expense">' + fmtR(usado) + '</td>' +
      '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="page-header">' +
        '<h2>Meus Cartões</h2>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<select id="sel-mes-lista" style="padding:7px 12px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface)">' +
            MESES_NOMES_LISTA.map(function (m, i) {
              return '<option value="' + i + '"' + (i === mesListaIdx ? ' selected' : '') + '>' + m + ' 2026</option>';
            }).join('') +
          '</select>' +
          '<a href="#cad-cartoes" class="btn btn-primary">+ Cadastrar Cartão</a>' +
        '</div>' +
      '</div>' +
      '<p style="font-size:13px;color:var(--color-muted);margin:-8px 0 16px">Clique em um cartão para ver os lançamentos.</p>' +

      '<div class="section-box" style="margin-bottom:24px">' +
        '<div class="cards-grid" id="cards-grid">' + cartoesHTML + '</div>' +
      '</div>' +

      '<div class="section-box">' +
        '<div class="section-box-header"><h2>Resumo dos Cartões · ' + MESES_NOMES_LISTA[mesListaIdx] + '</h2></div>' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Cartão</th><th>Fatura do mês</th>' +
          '</tr></thead>' +
          '<tbody>' + resumoHTML + '</tbody>' +
        '</table>' +
      '</div>';

    document.getElementById('sel-mes-lista').addEventListener('change', function () {
      mesListaIdx = parseInt(this.value);
      AppState.set(mesListaIdx, AppState.ano);
      renderLista();
    });

    // Clique no cartão → abre detalhe (já com o mês selecionado)
    document.getElementById('cards-grid').addEventListener('click', function (e) {
      var card = e.target.closest('.credit-card[data-id]');
      if (!card) return;
      var id = parseInt(card.dataset.id);
      var cartao = AppData.cartoes.find(function (c) { return c.id === id; });
      if (cartao) renderDetalhe(cartao);
    });
  }

  // ── Tela de detalhe do cartão ──
  function renderDetalhe(c) {
    var cardStyle = getBancoCardStyle(c.cor, c.nome);

    var filtroRespId = 'todos';
    var filtroMesIdx = mesListaIdx; // herda o mês selecionado na lista
    var filtrosCab   = { cat: '', resp: '' }; // filtros de cabeçalho
    var sortState    = { col: 'created_at', dir: -1 };  // padrão: último cadastrado no topo

    var FUNNEL_SVG_D =
      '<svg class="th-funnel-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M1.5 2h13l-5 6v5l-3-1.5V8L1.5 2z"/>' +
      '</svg>';

    var SORT_ICON = '<span class="th-sort-icon"> ↕</span>';

    function getLancs() {
      var mesNum = String(filtroMesIdx + 1).padStart(2, '0');
      return AppData.getLancamentos().filter(function (l) {
        if (!l) return false;
        if (l.cartaoId !== c.id && l.cartaoNome !== c.nome) return false;
        var partes = l.data.split('/');
        if (partes[1] !== mesNum) return false;
        if (filtroRespId === 'todos') return true;
        return String(l.responsavelId) === filtroRespId;
      });
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    // ── Ordenação em memória ──
    function sortLancs(arr) {
      return arr.slice().sort(function (a, b) {
        var va, vb;
        if (sortState.col === 'created_at') {
          va = a.id || 0; vb = b.id || 0;
        } else if (sortState.col === 'data') {
          var pa = (a.data || '').split('/'); va = (pa[2] || '') + (pa[1] || '') + (pa[0] || '');
          var pb = (b.data || '').split('/'); vb = (pb[2] || '') + (pb[1] || '') + (pb[0] || '');
        } else if (sortState.col === 'desc') {
          va = (a.desc || '').toLowerCase(); vb = (b.desc || '').toLowerCase();
        } else if (sortState.col === 'cat') {
          va = (a.cat || '').toLowerCase(); vb = (b.cat || '').toLowerCase();
        } else if (sortState.col === 'resp') {
          va = (a.responsavelNome || '').toLowerCase(); vb = (b.responsavelNome || '').toLowerCase();
        } else if (sortState.col === 'valor') {
          va = a.valor || 0; vb = b.valor || 0;
        } else { return 0; }
        if (va < vb) return -sortState.dir;
        if (va > vb) return  sortState.dir;
        return 0;
      });
    }

    function updateSortHeaders() {
      ['created_at', 'data', 'desc', 'cat', 'resp', 'valor'].forEach(function (col) {
        var th   = document.getElementById('th-col-' + col);
        if (!th) return;
        var icon = th.querySelector('.th-sort-icon');
        if (sortState.col === col) {
          th.classList.add('th-sort-active');
          if (icon) icon.textContent = sortState.dir === 1 ? ' ↑' : ' ↓';
        } else {
          th.classList.remove('th-sort-active');
          if (icon) icon.textContent = ' ↕';
        }
      });
    }

    // ── Aplica filtros de cabeçalho e recalcula total ──
    function aplicarFiltrosCab() {
      var rows        = document.querySelectorAll('#tbody-lanc-detalhe tr[data-id]');
      var totalVis    = 0;
      var totalConcil = 0;
      rows.forEach(function (tr) {
        var ok = true;
        if (filtrosCab.cat  && (tr.dataset.cat  || '') !== filtrosCab.cat)  ok = false;
        if (filtrosCab.resp && (tr.dataset.resp || '') !== filtrosCab.resp)  ok = false;
        tr.style.display = ok ? '' : 'none';
        if (ok) {
          var v    = Math.abs(parseFloat(tr.dataset.valor) || 0);
          var sign = tr.dataset.tipo === 'receita' ? -1 : 1;
          totalVis    += sign * v;
          if (tr.classList.contains('tr-conciliado')) totalConcil += sign * v;
        }
      });
      var elTotal = document.getElementById('lanc-header-total');
      if (elTotal) {
        if (totalVis > 0)      elTotal.textContent = 'Total: -' + fmtR(totalVis);
        else if (totalVis < 0) elTotal.textContent = 'Total: +' + fmtR(-totalVis);
        else                   elTotal.textContent = '';
      }
      var elConcil = document.getElementById('lanc-concil-info');
      if (elConcil) {
        elConcil.innerHTML = totalConcil > 0
          ? 'Conferido: <strong>' + fmtR(totalConcil) + '</strong>' +
            '<span class="concil-de"> de ' + fmtR(totalVis) + '</span>'
          : '';
      }
      // indicadores de filtro ativo (na trigger do funil)
      var trigCat  = document.getElementById('th-cat-filter');
      var trigResp = document.getElementById('th-resp-filter');
      if (trigCat)  trigCat.classList.toggle('th-filter-active',  !!filtrosCab.cat);
      if (trigResp) trigResp.classList.toggle('th-filter-active', !!filtrosCab.resp);
    }

    function abrirFiltroDetalhe(th, col) {
      var existing = document.getElementById('header-filter-popup');
      if (existing) existing.remove();

      var opts = [];
      if (col === 'resp') {
        AppData.responsaveis.forEach(function (r) {
          if (r.nome && opts.indexOf(r.nome) === -1) opts.push(r.nome);
        });
      } else {
        AppData.getLancamentos().forEach(function (l) {
          if ((l.cartaoId === c.id || l.cartaoNome === c.nome) && l.cat && opts.indexOf(l.cat) === -1) opts.push(l.cat);
        });
      }
      opts.sort();

      var popup = document.createElement('div');
      popup.id = 'header-filter-popup';
      popup.className = 'header-filter-popup';
      var current = filtrosCab[col];
      var html = '<div class="hfp-item' + (!current ? ' hfp-item-active' : '') + '" data-val=""><span class="hfp-check">✓</span>Todos</div>';
      opts.forEach(function (o) {
        var oEsc   = o.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var valEsc = o.replace(/"/g, '&quot;');
        html += '<div class="hfp-item' + (o === current ? ' hfp-item-active' : '') + '" data-val="' + valEsc + '"><span class="hfp-check">✓</span>' + oEsc + '</div>';
      });
      popup.innerHTML = html;

      var rect = th.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.top      = (rect.bottom + 4) + 'px';
      popup.style.left     = rect.left + 'px';
      popup.style.minWidth = Math.max(rect.width, 180) + 'px';

      popup.addEventListener('click', function (e) {
        var item = e.target.closest('.hfp-item');
        if (!item) return;
        filtrosCab[col] = item.dataset.val;
        popup.remove();
        aplicarFiltrosCab();
      });
      document.body.appendChild(popup);

      setTimeout(function () {
        function onOut(e) {
          if (!e.target.closest('#header-filter-popup') && !e.target.closest('.th-filter-trigger')) {
            var p = document.getElementById('header-filter-popup');
            if (p) p.remove();
            document.removeEventListener('click', onOut);
          }
        }
        document.addEventListener('click', onOut);
      }, 0);
    }

    function renderTabela() {
      var lancs      = sortLancs(getLancs());
      var totalGasto = lancs.reduce(function (s, l) {
        return s + (l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor));
      }, 0);
      var porCat = {};
      lancs.forEach(function (l) {
        var contrib = l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor);
        porCat[l.cat] = (porCat[l.cat] || 0) + contrib;
      });

      var lancHTML = lancs.length
        ? lancs.map(function (l, idx) {
            var temParcelas = l.totalParcelas > 1;
            var parcelasHTML = temParcelas
              ? '<div style="font-weight:700;font-size:13px">' + pad2(l.parcela) + ' / ' + pad2(l.totalParcelas) + '</div>' +
                '<div style="font-size:11px;color:var(--color-muted)">' + (l.totalParcelas - l.parcela) + ' restante' + (l.totalParcelas - l.parcela !== 1 ? 's' : '') + '</div>'
              : '<span style="color:var(--color-muted)">—</span>';
            var tagParcelada = temParcelas
              ? ' <span style="font-size:11px;background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;' +
                'border-radius:20px;padding:2px 9px;font-weight:600;vertical-align:middle;display:inline-block">' +
                'Compra parcelada ' + l.parcela + '/' + l.totalParcelas + '</span>'
              : '';
            var catEscR  = (l.cat || '').replace(/"/g, '&quot;');
            var respRowN = l.isDividido && l.splits && l.splits.length
              ? l.splits.map(function (s) { return s.respNome; }).join(' / ')
              : (l.responsavelNome || '');
            var respEscR = respRowN.replace(/"/g, '&quot;');
            var isAdiant = l.tipo === 'receita';
            return '<tr data-id="' + l.id + '" data-cat="' + catEscR + '" data-resp="' + respEscR + '" data-valor="' + l.valor + '" data-tipo="' + (l.tipo || 'despesa') + '"' +
                   (l.conciliado ? ' class="tr-conciliado"' : '') + '>' +
              '<td style="padding:0 4px 0 10px"><input type="checkbox" class="chk-lanc" data-id="' + l.id + '" style="width:15px;height:15px;cursor:pointer;accent-color:#ef4444"></td>' +
              '<td class="td-concil"><input type="checkbox" class="chk-concil" data-id="' + l.id + '"' +
                  (l.conciliado ? ' checked' : '') + ' title="Marcar como conferido"></td>' +
              '<td style="text-align:center;color:var(--color-muted);font-size:10px;letter-spacing:0.01em;opacity:0.6">' + l.id + '</td>' +
              '<td style="color:var(--color-muted);font-size:13px;white-space:nowrap">' + l.data + '</td>' +
              '<td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>' + l.desc + '</strong>' + tagParcelada + '</td>' +
              '<td style="color:var(--color-muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (l.cat || '—') + '</td>' +
              '<td style="color:var(--color-muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                (l.responsavelNome || '—') +
              '</td>' +
              '<td style="text-align:center">' + parcelasHTML + '</td>' +
              '<td class="' + (isAdiant ? 'amount-income' : 'amount-expense') + '">' + (isAdiant ? '+' : '-') + fmtR(Math.abs(l.valor)) + '</td>' +
              '<td style="padding:8px 10px">' +
                '<button class="btn btn-outline btn-editar-lanc" data-id="' + l.id + '" style="font-size:12px;padding:4px 8px">Editar</button>' +
                '<button class="btn btn-excluir-lanc" data-id="' + l.id + '" style="font-size:12px;padding:4px 8px;background:var(--color-expense-bg);color:var(--color-expense);border-radius:8px;font-weight:600;margin-left:4px">Excluir</button>' +
              '</td>' +
            '</tr>';
          }).join('')
        : '<tr><td colspan="10" style="text-align:center;color:var(--color-muted);padding:24px">Nenhum lançamento registrado.</td></tr>';

      var totalAbsCat = Object.keys(porCat).reduce(function (s, k) { return s + Math.abs(porCat[k]); }, 0);
      var catHTML = Object.keys(porCat).filter(function (k) { return porCat[k] !== 0; }).map(function (cat) {
        var net    = porCat[cat];
        var pctCat = totalAbsCat > 0 ? Math.round((Math.abs(net) / totalAbsCat) * 100) : 0;
        var cls    = net < 0 ? 'amount-expense' : 'amount-income';
        var cor    = net < 0 ? 'var(--color-expense)' : 'var(--color-income)';
        return '<tr>' +
          '<td>' + cat + '</td>' +
          '<td class="' + cls + '">' + (net < 0 ? '-' : '+') + fmtR(Math.abs(net)) + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:8px">' +
            '<div class="bar-wrap"><div style="height:100%;width:' + pctCat + '%;background:' + cor + ';border-radius:4px"></div></div>' +
            '<span style="font-size:13px;color:var(--color-muted)">' + pctCat + '%</span>' +
          '</div></td>' +
        '</tr>';
      }).join('');

      document.getElementById('cat-box').innerHTML =
        catHTML
          ? '<table class="data-table"><thead><tr><th>Categoria</th><th>Total</th><th>Participação</th></tr></thead><tbody>' + catHTML + '</tbody></table>'
          : '<p style="padding:20px;color:var(--color-muted);font-size:14px">Nenhum dado disponível.</p>';

      document.getElementById('tbody-lanc-detalhe').innerHTML = lancHTML;
      aplicarFiltrosCab();  // calcula total e aplica filtros de cabeçalho ativos
      updateSortHeaders();  // atualiza ícones e destaque da coluna ordenada
      // Sincroniza o estado do "marcar todos conciliados"
      var chkTC = document.getElementById('chk-todos-concil');
      if (chkTC) chkTC.checked = lancs.length > 0 && lancs.every(function (l) { return l.conciliado; });

      // ── Lógica de seleção em massa ──
      var barra    = document.getElementById('barra-selecao');
      var contagem = document.getElementById('sel-contagem');
      var chkTodos = document.getElementById('chk-todos');
      var btnExcluirSel = document.getElementById('btn-excluir-selecionados');

      function getSelecionados() {
        return Array.from(document.querySelectorAll('.chk-lanc:checked'))
          .map(function (cb) { return parseInt(cb.dataset.id); });
      }

      function atualizarBarra() {
        var sel = getSelecionados();
        if (sel.length > 0) {
          barra.style.display = 'flex';
          contagem.textContent = sel.length + ' lançamento' + (sel.length !== 1 ? 's' : '') + ' selecionado' + (sel.length !== 1 ? 's' : '');
        } else {
          barra.style.display = 'none';
          if (chkTodos) chkTodos.checked = false;
        }
      }

      // Selecionar/desmarcar todos
      if (chkTodos) {
        chkTodos.addEventListener('change', function () {
          document.querySelectorAll('.chk-lanc').forEach(function (cb) {
            cb.checked = chkTodos.checked;
          });
          atualizarBarra();
        });
      }

      // ── Checkbox de conciliação ──
      document.getElementById('tbody-lanc-detalhe').addEventListener('change', function (e) {
        if (!e.target.classList.contains('chk-concil')) return;
        var id      = parseInt(e.target.dataset.id);
        var checked = e.target.checked;
        var lanc    = AppData.getLancamentos().find(function (l) { return l.id === id; });
        if (lanc) lanc.conciliado = checked;
        var tr = e.target.closest('tr');
        if (tr) tr.classList.toggle('tr-conciliado', checked);
        aplicarFiltrosCab();
        AppData.updateLancamento(id, { conciliado: checked })
          .catch(function (err) { console.error('Erro ao salvar conciliação:', err); });
      });

      // ── Checkbox "marcar todos conciliados" ──
      document.getElementById('chk-todos-concil').addEventListener('change', function () {
        var marcado = this.checked;
        var lancs   = getLancs();
        lancs.forEach(function (l) {
          if (l.conciliado === marcado) return;
          l.conciliado = marcado;
          var chk = document.querySelector('.chk-concil[data-id="' + l.id + '"]');
          if (chk) chk.checked = marcado;
          var tr = chk && chk.closest('tr');
          if (tr) tr.classList.toggle('tr-conciliado', marcado);
          AppData.updateLancamento(l.id, { conciliado: marcado })
            .catch(function (err) { console.error('Erro ao salvar conciliação:', err); });
        });
        aplicarFiltrosCab();
      });

      // Clique em checkbox individual (bulk delete)
      document.getElementById('tbody-lanc-detalhe').addEventListener('change', function (e) {
        if (!e.target.classList.contains('chk-lanc')) return;
        var todos = document.querySelectorAll('.chk-lanc');
        var marcados = document.querySelectorAll('.chk-lanc:checked');
        if (chkTodos) chkTodos.checked = todos.length > 0 && todos.length === marcados.length;
        atualizarBarra();
      });

      // Excluir selecionados
      if (btnExcluirSel) {
        btnExcluirSel.addEventListener('click', async function () {
          var ids = getSelecionados();
          if (!ids.length) return;
          if (!confirm('Excluir ' + ids.length + ' lançamento' + (ids.length !== 1 ? 's' : '') + '? Essa ação não pode ser desfeita.')) return;

          btnExcluirSel.disabled = true;
          btnExcluirSel.textContent = 'Excluindo...';

          try {
            await AppData.removeLancamentosEmMassa(ids);
          } catch (e) {
            alert('Erro ao excluir: ' + (e.message || e));
            btnExcluirSel.disabled = false;
            btnExcluirSel.textContent = 'Excluir Selecionados';
            return;
          }

          renderTabela();
        });
      }

      atualizarFaturaCard();
    }

    // ── Renderiza estrutura da página (re-executada ao trocar mês) ──
    function renderPaginaDetalhe() {
      var mesNome = MESES_NOMES_LISTA[filtroMesIdx];
      var usado   = AppData.getTotalCartaoMes(c.id, filtroMesIdx);
      var temAnt  = filtroMesIdx > 0;
      var temProx = filtroMesIdx < 11;

      container.innerHTML =
        '<div class="page-header">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<button class="btn btn-outline" id="btn-voltar-cartoes" style="font-size:13px;padding:6px 14px">← Voltar</button>' +
            '<h2>' + c.nome + '</h2>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<button class="btn btn-outline" id="btn-mes-ant" style="font-size:16px;padding:5px 12px;line-height:1"' + (temAnt ? '' : ' disabled style="opacity:.4;cursor:default"') + '>‹</button>' +
            '<span style="font-size:14px;font-weight:600;min-width:130px;text-align:center">' + mesNome + ' 2026</span>' +
            '<button class="btn btn-outline" id="btn-mes-prox" style="font-size:16px;padding:5px 12px;line-height:1"' + (temProx ? '' : ' disabled style="opacity:.4;cursor:default"') + '>›</button>' +
            '<button class="btn btn-primary" id="btn-novo-lanc-cartao">+ Novo Lançamento</button>' +
            '<button class="btn btn-outline" id="btn-adiant-cartao" style="color:#16a34a;border-color:#16a34a">+ Adiantamento</button>' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start;margin-bottom:24px" class="detalhe-cartao-grid">' +
          '<div class="credit-card" style="max-width:300px;cursor:default;background:' + cardStyle.gradient + ';color:' + cardStyle.textColor + '">' +
            '<div class="card-gloss"></div>' +
            '<div class="card-top">' +
              '<div>' + getBancoLogoHTML(c.nome, cardStyle.textColor) + '</div>' +
              '<div>' + getBandeiraHTML(c.bandeira) + '</div>' +
            '</div>' +
            '<div class="card-name" style="margin:10px 0 0">' + c.nome + '</div>' +
            '<div class="card-number">•••• •••• •••• ••••</div>' +
            '<div class="card-bottom">' +
              '<div class="card-limit-label">Fatura ' + mesNome + '</div>' +
              '<div class="card-amounts">' +
                '<span id="card-fatura-valor" style="font-size:18px;font-weight:700">' + fmtR(usado) + '</span>' +
              '</div>' +
              '<div style="font-size:11px;opacity:0.65;margin-top:4px">Fecha dia ' + c.fechamento + ' · Vence dia ' + c.vencimento + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="section-box" style="margin:0">' +
            '<div class="section-box-header"><h2>Gastos por Categoria</h2></div>' +
            '<div id="cat-box"></div>' +
          '</div>' +
        '</div>' +

        '<div class="section-box">' +
          '<div class="section-box-header">' +
            '<h2>Fatura de ' + mesNome + ' 2026</h2>' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<select id="filtro-resp-lanc" style="padding:6px 10px;border:1px solid var(--color-border);border-radius:8px;font-size:13px;background:var(--color-surface)">' +
                '<option value="todos">Todos os Responsáveis</option>' +
                AppData.responsaveis.map(function (r) {
                  return '<option value="' + r.id + '"' + (String(r.id) === filtroRespId ? ' selected' : '') + '>' + r.nome + '</option>';
                }).join('') +
              '</select>' +
              '<span id="lanc-header-total" style="font-size:14px;font-weight:600" class="amount-expense"></span>' +
              '<span id="lanc-concil-info" class="lanc-concil-info"></span>' +
            '</div>' +
          '</div>' +

          // Barra de seleção em massa (oculta por padrão)
          '<div id="barra-selecao" style="display:none;align-items:center;justify-content:space-between;' +
               'padding:10px 20px;background:#fef2f2;border-bottom:1px solid #fecaca">' +
            '<span id="sel-contagem" style="font-size:13px;font-weight:600;color:#b91c1c"></span>' +
            '<button id="btn-excluir-selecionados" style="background:#ef4444;color:#fff;border:none;' +
                 'border-radius:8px;padding:7px 18px;font-size:13px;font-weight:700;cursor:pointer">' +
              'Excluir Selecionados' +
            '</button>' +
          '</div>' +

          '<table class="data-table lc-resizable-table" id="lc-table-detalhe" style="table-layout:fixed;width:100%">' +
            '<colgroup>' +
              '<col id="lcc-sel" style="width:36px">' +
              '<col id="lcc-concil" style="width:36px">' +
              '<col id="lcc-num"    style="width:54px">' +
              '<col id="lcc-data"   style="width:100px">' +
              '<col id="lcc-desc">' +
              '<col id="lcc-cat"    style="width:115px">' +
              '<col id="lcc-resp"   style="width:125px">' +
              '<col id="lcc-parc"   style="width:76px">' +
              '<col id="lcc-valor"  style="width:110px">' +
              '<col id="lcc-acoes"  style="width:148px">' +
            '</colgroup>' +
            '<thead><tr>' +
              '<th style="padding:0 4px 0 10px">' +
                '<input type="checkbox" id="chk-todos" style="width:15px;height:15px;cursor:pointer;accent-color:#ef4444" title="Selecionar todos para excluir">' +
              '</th>' +
              '<th class="th-concil-hdr" title="Marcar todos como conciliados">' +
                '<input type="checkbox" id="chk-todos-concil" style="width:15px;height:15px;cursor:pointer;accent-color:#10b981" title="Marcar todos como conciliados">' +
              '</th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-num" id="th-col-created_at" title="Ordem de Cadastro" style="text-align:center">#' + SORT_ICON + '<span class="lc-resize-handle"></span></th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-data" id="th-col-data">Data' + SORT_ICON + '<span class="lc-resize-handle"></span></th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-desc" id="th-col-desc">Descrição' + SORT_ICON + '<span class="lc-resize-handle"></span></th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-cat" id="th-col-cat">Cat.' + SORT_ICON +
                '<span class="th-filter-trigger" id="th-cat-filter" title="Filtrar por categoria">' + FUNNEL_SVG_D + '</span>' +
                '<span class="lc-resize-handle"></span></th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-resp" id="th-col-resp">Resp.' + SORT_ICON +
                '<span class="th-filter-trigger" id="th-resp-filter" title="Filtrar por responsável">' + FUNNEL_SVG_D + '</span>' +
                '<span class="lc-resize-handle"></span></th>' +
              '<th class="lc-th-resize" data-col="lcc-parc" style="text-align:center">Parcelas<span class="lc-resize-handle"></span></th>' +
              '<th class="th-sortable lc-th-resize" data-col="lcc-valor" id="th-col-valor">Valor' + SORT_ICON + '<span class="lc-resize-handle"></span></th>' +
              '<th>Ações</th>' +
            '</tr></thead>' +
            '<tbody id="tbody-lanc-detalhe"></tbody>' +
          '</table>' +
        '</div>';

      renderTabela();

      document.getElementById('btn-voltar-cartoes').addEventListener('click', function () {
        container.onclick = null;
        renderLista();
      });
      document.getElementById('btn-novo-lanc-cartao').addEventListener('click', abrirNovo);
      document.getElementById('btn-adiant-cartao').addEventListener('click', abrirAdiantamento);
      // ── Sort: clique nos cabeçalhos (exceto no ícone de filtro) ──
      ['created_at', 'data', 'desc', 'cat', 'resp', 'valor'].forEach(function (col) {
        document.getElementById('th-col-' + col).addEventListener('click', function (e) {
          if (e.target.closest('.th-filter-trigger')) return;
          if (sortState.col === col) {
            sortState.dir = -sortState.dir;
          } else {
            sortState.col = col;
            sortState.dir = 1;
          }
          renderTabela();
        });
      });
      // ── Filter: clique no ícone de funil ──
      document.getElementById('th-cat-filter').addEventListener('click', function (e) {
        e.stopPropagation();
        abrirFiltroDetalhe(document.getElementById('th-col-cat'), 'cat');
      });
      document.getElementById('th-resp-filter').addEventListener('click', function (e) {
        e.stopPropagation();
        abrirFiltroDetalhe(document.getElementById('th-col-resp'), 'resp');
      });
      document.getElementById('filtro-resp-lanc').addEventListener('change', function () {
        filtroRespId = this.value;
        renderTabela();
      });

      // ── Colunas redimensionáveis ──────────────────────────────
      var LC_LS_KEY = 'lc-col-widths-' + c.id;

      function lcSaveWidths() {
        var saved = {};
        document.querySelectorAll('#lc-table-detalhe col[id]').forEach(function (col) {
          if (col.style.width) saved[col.id] = col.style.width;
        });
        localStorage.setItem(LC_LS_KEY, JSON.stringify(saved));
      }

      function lcLoadWidths() {
        try {
          var saved = JSON.parse(localStorage.getItem(LC_LS_KEY) || '{}');
          Object.keys(saved).forEach(function (id) {
            var col = document.getElementById(id);
            if (col) col.style.width = saved[id];
          });
        } catch (e) {}
      }
      lcLoadWidths();

      document.querySelectorAll('#lc-table-detalhe .lc-resize-handle').forEach(function (handle) {
        var th, colEl, startX, startW;

        handle.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          th    = handle.closest('th');
          colEl = document.getElementById(th.dataset.col);
          startX = e.clientX;
          startW = colEl ? parseInt(colEl.style.width || th.offsetWidth) : th.offsetWidth;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';

          function onMove(ev) {
            var newW = Math.max(40, startW + (ev.clientX - startX));
            if (colEl) colEl.style.width = newW + 'px';
          }
          function onUp() {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            lcSaveWidths();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      });
      if (temAnt) {
        document.getElementById('btn-mes-ant').addEventListener('click', function () {
          filtroMesIdx--; mesListaIdx = filtroMesIdx;
          AppState.set(filtroMesIdx, AppState.ano);
          renderPaginaDetalhe();
        });
      }
      if (temProx) {
        document.getElementById('btn-mes-prox').addEventListener('click', function () {
          filtroMesIdx++; mesListaIdx = filtroMesIdx;
          AppState.set(filtroMesIdx, AppState.ano);
          renderPaginaDetalhe();
        });
      }
      document.getElementById('tbody-lanc-detalhe').addEventListener('click', async function (e) {
        var btnEditar  = e.target.closest('.btn-editar-lanc');
        var btnExcluir = e.target.closest('.btn-excluir-lanc');
        if (btnEditar) {
          var id   = parseInt(btnEditar.dataset.id);
          var lanc = AppData.getLancamentos().find(function (l) { return l.id === id; });
          if (lanc) abrirEditar(lanc);
        }
        if (btnExcluir) {
          var id   = parseInt(btnExcluir.dataset.id);
          var lanc = AppData.getLancamentos().find(function (l) { return l.id === id; });
          if (!lanc) return;
          if (!confirm('Excluir o lançamento "' + lanc.desc + '"?\nEsta ação não pode ser desfeita.')) return;
          await AppData.removeLancamento(id);
          renderTabela();
        }
      });
    }

    renderPaginaDetalhe();

    // ── Avança N meses mantendo o mesmo dia ──
    function somarMeses(dataISO, n) {
      var p   = dataISO.split('-');
      var ano = parseInt(p[0]), mes = parseInt(p[1]) - 1, dia = parseInt(p[2]);
      var d   = new Date(ano, mes + n, dia);
      var mesAlvo = ((mes + n) % 12 + 12) % 12;
      if (d.getMonth() !== mesAlvo) d = new Date(ano + Math.floor((mes + n) / 12), mesAlvo + 1, 0);
      return String(d.getDate()).padStart(2,'0') + '/' +
             String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    }

    // Converte "DD/MM/YYYY" → "YYYY-MM-DD" para o input date
    function fmtISO(dataBR) {
      var p = dataBR.split('/');
      return p[2] + '-' + p[1] + '-' + p[0];
    }

    // ── Atualiza o valor da fatura no card sem re-renderizar a página ──
    function atualizarFaturaCard() {
      var el = document.getElementById('card-fatura-valor');
      if (!el) return;
      el.textContent = fmtR(AppData.getTotalCartaoMes(c.id, filtroMesIdx));
    }

    // ── Modal de lançamento ──
    var antModal = document.getElementById('modal-lanc-cartao');
    if (antModal) antModal.remove();

    var editandoId   = null;
    var editandoTipo = 'despesa';

    var optsResp = '<option value="">— Sem responsável —</option>' +
      AppData.responsaveis.map(function (r) {
        return '<option value="' + r.id + '">' + r.nome + '</option>';
      }).join('');

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-lanc-cartao';
    modal.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3 id="lc-titulo">Novo Lançamento · ' + c.nome + '</h3>' +
          '<button class="modal-close" id="btn-fechar-lanc-cartao">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="date" id="lc-data" />' +
            '</div>' +
            '<div class="form-group" id="lc-resp-grupo">' +
              '<label>Responsável</label>' +
              '<select id="lc-resp">' + optsResp + '</select>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;font-weight:500;font-size:14px">' +
              '<input type="checkbox" id="lc-dividido" style="width:16px;height:16px;accent-color:var(--color-primary)" />' +
              'Dividir entre responsáveis' +
            '</label>' +
          '</div>' +
          '<div id="lc-splits-grupo" style="display:none;background:#f8fafc;border:1px solid var(--color-border);border-radius:10px;padding:14px;margin-bottom:4px">' +
            '<div style="font-size:12px;font-weight:600;color:var(--color-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Selecione os responsáveis</div>' +
            AppData.responsaveis.map(function (r) {
              return '<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--color-border)">' +
                '<span style="display:flex;align-items:center;gap:8px">' +
                  '<input type="checkbox" class="lc-split-check" data-id="' + r.id + '" data-nome="' + r.nome + '" style="width:15px;height:15px;accent-color:var(--color-primary)" />' +
                  r.nome +
                '</span>' +
                '<span class="lc-split-val" data-id="' + r.id + '" style="font-size:13px;color:var(--color-muted)">—</span>' +
              '</label>';
            }).join('') +
            '<div style="font-size:13px;color:var(--color-primary);font-weight:600;margin-top:10px" id="lc-split-resumo"></div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="lc-desc" placeholder="Ex: Supermercado Extra" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Categoria</label>' +
              '<select id="lc-cat">' +
                '<option value="">— Selecione —</option>' +
                AppData.categorias.map(function (c) {
                  return '<option value="' + c.nome + '">' + c.nome + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Valor (R$)</label>' +
              '<input type="number" id="lc-valor" placeholder="0,00" min="0" step="0.01" />' +
            '</div>' +
          '</div>' +
          '<div id="lc-parcelas-grupo">' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label>Iniciar da parcela nº</label>' +
                '<input type="number" id="lc-parcela-ini" value="1" min="1" max="48" style="max-width:100px" />' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Total de parcelas</label>' +
                '<input type="number" id="lc-parcelas" value="1" min="1" max="48" style="max-width:100px" />' +
              '</div>' +
            '</div>' +
            '<p style="font-size:12px;color:var(--color-muted);margin-top:-4px">' +
              'Ex: parcela 6 de 10 → cria apenas 6, 7, 8, 9 e 10 nos meses seguintes.' +
            '</p>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer" id="lc-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-lanc-cartao">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-lanc-cartao">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // ── Listeners: dividir entre responsáveis ──
    document.getElementById('lc-dividido').addEventListener('change', function () {
      var dividido = this.checked;
      document.getElementById('lc-resp-grupo').style.display   = dividido ? 'none' : '';
      document.getElementById('lc-splits-grupo').style.display = dividido ? '' : 'none';
      if (dividido) atualizarSplitPreview();
    });
    document.getElementById('lc-valor').addEventListener('input', function () {
      if (document.getElementById('lc-dividido').checked) atualizarSplitPreview();
    });
    modal.querySelectorAll('.lc-split-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (document.getElementById('lc-dividido').checked) atualizarSplitPreview();
      });
    });

    function abrirNovo() {
      editandoId = null;
      restaurarFooter();
      document.getElementById('lc-titulo').textContent   = 'Novo Lançamento · ' + c.nome;
      var mm = String(filtroMesIdx + 1).padStart(2, '0');
      document.getElementById('lc-data').value           = AppState.ano + '-' + mm + '-01';
      document.getElementById('lc-resp').value           = '';
      document.getElementById('lc-desc').value           = '';
      document.getElementById('lc-cat').selectedIndex    = 0;
      document.getElementById('lc-valor').value          = '';
      document.getElementById('lc-parcela-ini').value    = '1';
      document.getElementById('lc-parcelas').value       = '1';
      document.getElementById('lc-parcelas-grupo').style.display = '';
      // Reset split state
      document.getElementById('lc-dividido').checked = false;
      document.getElementById('lc-resp-grupo').style.display   = '';
      document.getElementById('lc-splits-grupo').style.display = 'none';
      document.querySelectorAll('.lc-split-check').forEach(function (cb) { cb.checked = false; });
      document.querySelectorAll('.lc-split-val').forEach(function (s) { s.textContent = '—'; });
      document.getElementById('lc-split-resumo').textContent = '';
      modal.classList.add('open');
    }

    function abrirEditar(l) {
      editandoId   = l.id;
      editandoTipo = l.tipo || 'despesa';
      restaurarFooter();
      document.getElementById('lc-titulo').textContent = 'Editar Lançamento';
      document.getElementById('lc-data').value         = fmtISO(l.data);
      document.getElementById('lc-desc').value         = l.desc;
      document.getElementById('lc-cat').value          = l.cat;
      document.getElementById('lc-valor').value        = Math.abs(l.valor);
      document.getElementById('lc-parcelas-grupo').style.display = 'none';

      // Restore split state
      if (l.isDividido && l.splits && l.splits.length) {
        document.getElementById('lc-dividido').checked           = true;
        document.getElementById('lc-resp-grupo').style.display   = 'none';
        document.getElementById('lc-splits-grupo').style.display = '';
        document.getElementById('lc-resp').value                 = '';
        document.querySelectorAll('.lc-split-check').forEach(function (cb) {
          cb.checked = !!l.splits.find(function (s) { return String(s.respId) === cb.dataset.id; });
        });
        atualizarSplitPreview();
      } else {
        document.getElementById('lc-dividido').checked           = false;
        document.getElementById('lc-resp-grupo').style.display   = '';
        document.getElementById('lc-splits-grupo').style.display = 'none';
        document.getElementById('lc-resp').value                 = l.responsavelId || '';
        document.querySelectorAll('.lc-split-check').forEach(function (cb) { cb.checked = false; });
        document.querySelectorAll('.lc-split-val').forEach(function (s) { s.textContent = '—'; });
        document.getElementById('lc-split-resumo').textContent = '';
      }

      modal.classList.add('open');
    }

    function fecharModal() {
      modal.classList.remove('open');
    }

    function mostrarToast(msg) {
      var t = document.createElement('div');
      t.className = 'save-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add('save-toast-visible'); }, 10);
      setTimeout(function () {
        t.classList.remove('save-toast-visible');
        setTimeout(function () { t.remove(); }, 300);
      }, 2500);
    }

    function atualizarSplitPreview() {
      var valorInd = parseFloat(document.getElementById('lc-valor').value) || 0;
      var checked  = document.querySelectorAll('.lc-split-check:checked');
      var n        = checked.length;
      var totalDiv = Math.round(valorInd * n * 100) / 100;
      document.querySelectorAll('.lc-split-val').forEach(function (span) {
        var isChk = !!document.querySelector('.lc-split-check[data-id="' + span.dataset.id + '"]:checked');
        span.textContent = isChk && n > 0 ? fmtR(valorInd) : '—';
      });
      document.getElementById('lc-split-resumo').textContent = n > 0
        ? n + ' responsável(is) · ' + fmtR(valorInd) + ' cada · total ' + fmtR(totalDiv)
        : '';
    }

    function lerFormulario() {
      var selResp  = document.getElementById('lc-resp');
      var dividido = document.getElementById('lc-dividido').checked;
      var splits   = [];

      if (dividido) {
        var valorInd = parseFloat(document.getElementById('lc-valor').value) || 0;
        var checked  = document.querySelectorAll('.lc-split-check:checked');
        checked.forEach(function (cb) {
          splits.push({ respId: parseInt(cb.dataset.id), respNome: cb.dataset.nome, valor: valorInd });
        });
      }

      return {
        desc:       document.getElementById('lc-desc').value.trim(),
        total:      parseFloat(document.getElementById('lc-valor').value),
        dataISO:    document.getElementById('lc-data').value,
        cat:        document.getElementById('lc-cat').value,
        parcelaIni: parseInt(document.getElementById('lc-parcela-ini').value) || 1,
        parcelas:   parseInt(document.getElementById('lc-parcelas').value) || 1,
        isDividido: dividido && splits.length > 0,
        splits:     splits,
        respId:     !dividido && selResp.value ? parseInt(selResp.value) : null,
        respNome:   !dividido && selResp.value ? selResp.options[selResp.selectedIndex].textContent : null,
      };
    }

    function mostrarPopupParcelas(f, valorParcela) {
      var popup = document.createElement('div');
      popup.id = 'popup-parcelas';
      popup.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;' +
        'display:flex;align-items:center;justify-content:center;padding:20px';

      popup.innerHTML =
        '<div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;width:100%;' +
                    'box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center">' +
          '<div style="font-size:48px;margin-bottom:12px;color:var(--color-primary)"><i class="ph ph-credit-card"></i></div>' +
          '<h3 style="margin:0 0 8px;font-size:18px;color:#1a1d2e">' + f.desc + '</h3>' +
          '<p style="margin:0 0 6px;font-size:15px;color:#6b7280">' +
            'Parcelas <strong style="color:#1a1d2e">' + f.parcelaIni + '</strong> a ' +
            '<strong style="color:#1a1d2e">' + f.parcelas + '</strong>' +
            ' · <strong style="color:#1a1d2e">' + fmtR(valorParcela) + '</strong> cada' +
          '</p>' +
          '<p style="margin:0 0 24px;font-size:13px;color:#9ca3af">Valor total da compra: ' + fmtR(f.total) + '</p>' +
          '<p style="margin:0 0 20px;font-size:14px;color:#374151;font-weight:500">' +
            'Deseja criar as parcelas restantes nos meses seguintes?' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<button id="pp-replicar" style="padding:12px 20px;background:var(--color-primary);color:#fff;' +
              'border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
              '<i class="ph-bold ph-check"></i> Salvar e replicar parcelas' +
            '</button>' +
            '<button id="pp-apenas" style="padding:12px 20px;background:#f3f4f6;color:#374151;' +
              'border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">' +
              'Salvar apenas esta parcela' +
            '</button>' +
            '<button id="pp-cancelar" style="padding:10px 20px;background:none;color:#9ca3af;' +
              'border:none;font-size:13px;cursor:pointer;text-decoration:underline">' +
              'Cancelar' +
            '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(popup);

      document.getElementById('pp-replicar').addEventListener('click', async function () {
        popup.remove();
        await confirmarEtSalvar(f, true);
      });
      document.getElementById('pp-apenas').addEventListener('click', async function () {
        popup.remove();
        await confirmarEtSalvar(f, false);
      });
      document.getElementById('pp-cancelar').addEventListener('click', function () {
        popup.remove();
      });
    }

    async function confirmarEtSalvar(f, replicar) {
      var valorParcela = Math.round((f.total / f.parcelas) * 100) / 100;

      // Monta um lançamento simples — data original fixa; mes_referencia avança por parcela
      function buildLanc(offset, numParcela, respId, respNome, valor) {
        // Competência = mês selecionado no filtro + offset da parcela
        var baseAno = AppState.ano;
        var baseMes = filtroMesIdx; // 0-indexed
        var d       = new Date(baseAno, baseMes + offset, 1);
        var mesRef  = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        return {
          data:            f.dataISO,   // data original do registro (fixa para todas as parcelas)
          mes_referencia:  mesRef,
          desc:            f.desc,
          cat:             f.cat,
          valor:           -Math.abs(valor),
          cartaoId:        c.id,
          cartaoNome:      c.nome,
          responsavelId:   respId   || null,
          responsavelNome: respNome || null,
          parcela:         numParcela,
          totalParcelas:   f.parcelas,
          conciliado:      false
        };
      }

      try {
        var parcelaFim = replicar ? f.parcelas : f.parcelaIni;

        for (var p = f.parcelaIni; p <= parcelaFim; p++) {
          var offset = p - f.parcelaIni; // 0 na primeira parcela, +1 por mês

          if (f.isDividido && f.splits.length > 0) {
            // Divide: cria um lançamento por responsável com o valor individual (sem dividir novamente)
            for (var si = 0; si < f.splits.length; si++) {
              var s = f.splits[si];
              await AppData.addLancamento(buildLanc(offset, p, s.respId, s.respNome, valorParcela));
            }
          } else {
            await AppData.addLancamento(buildLanc(offset, p, f.respId, f.respNome, valorParcela));
          }
        }

        fecharModal();
        renderTabela();
        atualizarFaturaCard();
        mostrarToast('Lançamento salvo com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar lançamento:', err);
        alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
      }
    }

    function restaurarFooter() {
      document.getElementById('lc-footer').innerHTML =
        '<button class="btn btn-outline" id="btn-cancelar-lanc-cartao">Cancelar</button>' +
        '<button class="btn btn-primary" id="btn-salvar-lanc-cartao">Salvar</button>';
      document.getElementById('btn-cancelar-lanc-cartao').addEventListener('click', fecharModal);
      document.getElementById('btn-salvar-lanc-cartao').addEventListener('click', onSalvar);
    }

    async function onSalvar() {
      var f = lerFormulario();
      if (!f.desc || isNaN(f.total) || f.total <= 0) {
        alert('Preencha a descrição e o valor corretamente.');
        return;
      }
      if (!f.cat) {
        alert('Selecione uma categoria.');
        return;
      }
      var dividido = document.getElementById('lc-dividido').checked;
      if (dividido && f.splits.length === 0) {
        alert('Selecione ao menos um responsável para dividir.');
        return;
      }
      if (!dividido && !f.respId) {
        alert('Selecione um responsável.');
        return;
      }

      // Modo edição — atualiza o lançamento individualmente
      if (editandoId !== null) {
        try {
          await AppData.updateLancamento(editandoId, {
            data:            somarMeses(f.dataISO, 0),
            desc:            f.desc,
            cat:             f.cat,
            valor:           editandoTipo === 'receita' ? Math.abs(f.total) : -Math.abs(f.total),
            responsavelId:   f.respId   || null,
            responsavelNome: f.respNome || null
          });
          fecharModal();
          renderTabela();
          mostrarToast('Lançamento atualizado!');
        } catch (err) {
          console.error('Erro ao atualizar lançamento:', err);
          alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
        }
        return;
      }

      // Parcela única ou última parcela — salva direto sem popup
      if (f.parcelaIni >= f.parcelas) {
        await confirmarEtSalvar(f, true);
        return;
      }

      // Múltiplas parcelas restantes — exibe popup de confirmação
      var valorParcela = Math.round((f.total / f.parcelas) * 100) / 100;
      mostrarPopupParcelas(f, valorParcela);
    }

    document.getElementById('btn-fechar-lanc-cartao').addEventListener('click', fecharModal);
    document.getElementById('btn-cancelar-lanc-cartao').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });
    document.getElementById('btn-salvar-lanc-cartao').addEventListener('click', onSalvar);

    // ── Modal de Adiantamento ──────────────────────────────────
    var antModalAdiant = document.getElementById('modal-adiantamento-cartao');
    if (antModalAdiant) antModalAdiant.remove();

    var optsCategoriasAdiant = AppData.categorias.map(function (cat) {
      return '<option value="' + cat.nome + '">' + cat.nome + '</option>';
    }).join('');

    var optsRespAdiant = '<option value="">— Sem responsável —</option>' +
      AppData.responsaveis.map(function (r) {
        return '<option value="' + r.id + '" data-nome="' + r.nome.replace(/"/g, '&quot;') + '">' + r.nome + '</option>';
      }).join('');

    var modalAdiant = document.createElement('div');
    modalAdiant.className = 'modal-overlay';
    modalAdiant.id = 'modal-adiantamento-cartao';
    modalAdiant.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Adiantamento · ' + c.nome + '</h3>' +
          '<button class="modal-close" id="btn-fechar-adiant">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Data</label>' +
              '<input type="date" id="adiant-data" />' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Valor (R$)</label>' +
              '<input type="number" id="adiant-valor" placeholder="0,00" min="0" step="0.01" />' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Descrição</label>' +
            '<input type="text" id="adiant-desc" placeholder="Ex: Adiantamento fatura" />' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label>Categoria</label>' +
              '<select id="adiant-cat">' + optsCategoriasAdiant + '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Responsável</label>' +
              '<select id="adiant-resp">' + optsRespAdiant + '</select>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" id="btn-cancelar-adiant">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-adiant" style="background:#16a34a">Salvar Adiantamento</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalAdiant);

    function abrirAdiantamento() {
      var mm = String(filtroMesIdx + 1).padStart(2, '0');
      document.getElementById('adiant-data').value  = AppState.ano + '-' + mm + '-01';
      document.getElementById('adiant-valor').value = '';
      document.getElementById('adiant-desc').value  = '';
      document.getElementById('adiant-cat').selectedIndex = 0;
      document.getElementById('adiant-resp').value  = '';
      modalAdiant.classList.add('open');
    }

    function fecharModalAdiant() { modalAdiant.classList.remove('open'); }

    document.getElementById('btn-fechar-adiant').addEventListener('click', fecharModalAdiant);
    document.getElementById('btn-cancelar-adiant').addEventListener('click', fecharModalAdiant);
    modalAdiant.addEventListener('click', function (e) { if (e.target === modalAdiant) fecharModalAdiant(); });

    document.getElementById('btn-salvar-adiant').addEventListener('click', async function () {
      var dataISO  = document.getElementById('adiant-data').value;
      var valor    = parseFloat(document.getElementById('adiant-valor').value);
      var desc     = document.getElementById('adiant-desc').value.trim();
      var cat      = document.getElementById('adiant-cat').value;
      var selResp  = document.getElementById('adiant-resp');
      var respId   = selResp.value ? parseInt(selResp.value) : null;
      var respNome = selResp.value ? selResp.options[selResp.selectedIndex].dataset.nome : null;

      if (!desc || isNaN(valor) || valor <= 0) {
        alert('Preencha a descrição e o valor corretamente.');
        return;
      }
      if (!dataISO) { alert('Informe a data.'); return; }

      var d      = dataISO.split('-');
      var dmy    = d[2] + '/' + d[1] + '/' + d[0];
      var mesRef = d[0] + '-' + d[1];

      try {
        await AppData.addLancamento({
          data:            dmy,
          mes_referencia:  mesRef,
          desc:            desc,
          cat:             cat,
          valor:           valor,
          tipo:            'receita',
          cartaoId:        c.id,
          cartaoNome:      c.nome,
          responsavelId:   respId,
          responsavelNome: respNome,
          conciliado:      false
        });
        fecharModalAdiant();
        renderTabela();
        atualizarFaturaCard();
        mostrarToast('Adiantamento registrado!');
      } catch (err) {
        console.error('Erro ao salvar adiantamento:', err);
        alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
      }
    });
  }

  renderLista();
});
