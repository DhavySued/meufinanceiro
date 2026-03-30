// Banco de dados — Supabase (PostgreSQL)
var SUPABASE_URL = 'https://wvlrlhxelffuvcnpeoih.supabase.co';
var SUPABASE_KEY = 'sb_publishable_elDakDGsx-wegEOx67QaEw_jh2KwovJ';

var AppData = (function () {
  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Cache em memória (populado por init()) ──────────────
  var cartoes         = [];
  var responsaveis    = [];
  var lancamentos     = [];
  var despesasManuais = []; // in-memory até tabela ser criada
  var metas           = []; // in-memory até tabela ser criada
  var categorias      = [];
  var caixinhas       = [];
  var importacoes     = [];

  // ── Conversão de datas ──────────────────────────────────
  // Supabase armazena AAAA-MM-DD; o app usa DD/MM/AAAA
  function toISO(dmy) {
    if (!dmy || dmy.indexOf('-') !== -1) return dmy;
    var p = dmy.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
  }

  function toDMY(iso) {
    if (!iso || iso.indexOf('/') !== -1) return iso;
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function normalizeLanc(row) {
    if (row && row.data) row.data = toDMY(row.data);
    return row;
  }

  // ── Inicialização ────────────────────────────────────────
  async function init() {
    var results = await Promise.all([
      db.from('cartoes').select('*').order('id'),
      db.from('responsaveis').select('*').order('id'),
      db.from('lancamentos').select('*').order('data', { ascending: false }),
      db.from('categorias').select('*').order('id'),
      db.from('caixinhas').select('*').order('id'),
      db.from('importacoes').select('*').order('id', { ascending: false }),
      db.from('despesas_manuais').select('*').order('id'),
    ]);

    results.forEach(function (r, i) {
      if (r.error) console.error('Supabase init erro tabela ' + i + ':', r.error);
    });

    cartoes.splice(0,      cartoes.length,      ...(results[0].data || []));
    responsaveis.splice(0, responsaveis.length, ...(results[1].data || []));
    lancamentos.splice(0,  lancamentos.length,  ...(results[2].data || []).map(normalizeLanc));
    categorias.splice(0,   categorias.length,   ...(results[3].data || []));
    caixinhas.splice(0,    caixinhas.length,    ...(results[4].data || []));
    importacoes.splice(0,  importacoes.length,  ...(results[5].data || []));
    var rawManuais = results[6].data || [];
    console.log('[despesas_manuais] erro:', results[6].error);
    console.log('[despesas_manuais] raw do banco:', rawManuais);
    despesasManuais.splice(0, despesasManuais.length, ...rawManuais.map(function (r) {
      return { id: r.id, mesIdx: parseInt(r.mes_idx), respId: parseInt(r.resp_id), quinzena: parseInt(r.quinzena), desc: r.descricao, valor: parseFloat(r.valor) };
    }));
    console.log('[despesas_manuais] mapeado em memória:', despesasManuais);

    api.cartoes      = cartoes;
    api.responsaveis = responsaveis;
    api.categorias   = categorias;
    api.caixinhas    = caixinhas;
  }

  var api = {
    cartoes:      cartoes,
    responsaveis: responsaveis,
    categorias:   categorias,
    caixinhas:    caixinhas,

    init: init,

    // ── Cartões ─────────────────────────────────────────────
    getCartoesFluxo: function () {
      return cartoes.filter(function (c) { return c.exibirMesAMes; });
    },

    addCartao: async function (c) {
      var payload = Object.assign({}, c);
      delete payload.id;
      var { data, error } = await db.from('cartoes').insert(payload).select().single();
      if (error) throw error;
      cartoes.push(data);
      return data;
    },

    updateCartao: async function (id, dados) {
      var { data, error } = await db.from('cartoes').update(dados).eq('id', id).select().single();
      if (error) throw error;
      var idx = cartoes.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) Object.assign(cartoes[idx], data);
      return data;
    },

    removeCartao: async function (id) {
      var { error } = await db.from('cartoes').delete().eq('id', id);
      if (error) throw error;
      var idx = cartoes.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) cartoes.splice(idx, 1);
    },

    // ── Lançamentos ─────────────────────────────────────────
    getLancamentos: function () { return lancamentos; },

    addLancamento: async function (l) {
      var payload = Object.assign({}, l);
      delete payload.id;
      if (payload.data) payload.data = toISO(payload.data);
      console.log('[addLancamento] payload:', JSON.stringify(payload));
      var { data, error } = await db.from('lancamentos').insert(payload).select().single();
      if (error) {
        console.error('[addLancamento] erro Supabase:', error);
        throw error;
      }
      if (!data) throw new Error('Supabase retornou vazio após insert — verifique as políticas RLS da tabela lancamentos.');
      var row = normalizeLanc(data);
      lancamentos.unshift(row);
      return row;
    },

    updateLancamento: async function (id, dados) {
      var payload = Object.assign({}, dados);
      if (payload.data) payload.data = toISO(payload.data);
      var { data, error } = await db.from('lancamentos').update(payload).eq('id', id).select().single();
      if (error) throw error;
      var row = normalizeLanc(data);
      var idx = lancamentos.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) Object.assign(lancamentos[idx], row);
      return row;
    },

    toggleConciliado: async function (id) {
      var l = lancamentos.find(function (x) { return x.id === id; });
      if (!l) return;
      l.conciliado = !l.conciliado;
      return api.updateLancamento(id, { conciliado: l.conciliado });
    },

    removeLancamento: async function (id) {
      var { error } = await db.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
      var idx = lancamentos.findIndex(function (l) { return l.id === id; });
      if (idx !== -1) lancamentos.splice(idx, 1);
    },

    // Cria os lançamentos de uma compra parcelada a partir de l.parcela até l.totalParcelas.
    // Ex: parcela=7, totalParcelas=10 → grava registros 7, 8, 9, 10 (pulando 1-6).
    // Cada registro recebe parcela=p e totalParcelas=l.totalParcelas explicitamente.
    addLancamentosParcelados: async function (l) {
      var partes  = l.data.split('/');
      var mesBase = parseInt(partes[1]) - 1; // 0-indexed
      var anoBase = parseInt(partes[2]);
      var criados = [];

      for (var p = l.parcela; p <= l.totalParcelas; p++) {
        var offset   = p - l.parcela; // 0 na parcela inicial, cresce 1 por mês
        var d        = new Date(anoBase, mesBase + offset, 1);
        var mm       = String(d.getMonth() + 1).padStart(2, '0');
        var dataParc = '01/' + mm + '/' + d.getFullYear();
        var descParc = l.totalParcelas > 1
          ? l.desc + ' (' + p + '/' + l.totalParcelas + ')'
          : l.desc;

        var novo = await api.addLancamento({
          data:            dataParc,
          desc:            descParc,
          cat:             l.cat,
          cartaoId:        l.cartaoId,
          cartaoNome:      l.cartaoNome,
          valor:           l.valor,
          tipo:            l.tipo,
          parcela:         p,               // número correto desta parcela
          totalParcelas:   l.totalParcelas, // total sempre igual para todos os registros
          responsavelId:   l.responsavelId   || null,
          responsavelNome: l.responsavelNome || null,
        });
        criados.push(novo);
      }
      return criados;
    },

    removeLancamentosEmMassa: async function (ids) {
      if (!ids || !ids.length) return;
      var { error } = await db.from('lancamentos').delete().in('id', ids);
      if (error) throw error;
      ids.forEach(function (id) {
        var idx = lancamentos.findIndex(function (l) { return l.id === id; });
        if (idx !== -1) lancamentos.splice(idx, 1);
      });
    },

    // ── Totais de cartão por mês (calculado do cache) ───────
    getTotalCartaoMes: function (cartaoId, mesIdx) {
      var mesNum = String(mesIdx + 1).padStart(2, '0');
      var ano    = String(AppState.ano);
      var mesRef = ano + '-' + mesNum;
      return lancamentos
        .filter(function (l) {
          if (l.cartaoId !== cartaoId) return false;
          return AppData.getMesRef(l) === mesRef;
        })
        .reduce(function (s, l) {
          return s + (l.tipo === 'receita' ? -Math.abs(l.valor) : Math.abs(l.valor));
        }, 0);
    },

    // ── Retorna a competência YYYY-MM de um lançamento ──────
    getMesRef: function (l) {
      if (l && l.mes_referencia) return l.mes_referencia;
      if (l && l.data) {
        var p = l.data.split('/');
        if (p.length === 3) return p[2] + '-' + p[1];
      }
      return '';
    },

    // ── Responsáveis ────────────────────────────────────────
    getFluxoCaixa: function () {
      return responsaveis.filter(function (r) { return r.perfil === 'Administrador'; });
    },

    addResponsavel: async function (resp) {
      // Apenas colunas confirmadas da tabela responsaveis
      var payload = {
        nome:       resp.nome,
        email:      resp.email,
        perfil:     resp.perfil,
        fluxoCaixa: resp.fluxoCaixa,
        ganhos:     resp.ganhos     || [],
        despesasFixas: resp.despesasFixas || [],
        orcamentos:    resp.orcamentos    || [],
      };
      var { data, error } = await db.from('responsaveis').insert(payload).select().single();
      if (error) throw error;
      responsaveis.push(data);
      return data;
    },

    updateResponsavel: async function (id, dados) {
      var payload = {};
      if (dados.nome        !== undefined) payload.nome        = dados.nome;
      if (dados.email       !== undefined) payload.email       = dados.email;
      if (dados.perfil      !== undefined) payload.perfil      = dados.perfil;
      if (dados.fluxoCaixa  !== undefined) payload.fluxoCaixa  = dados.fluxoCaixa;
      if (dados.ganhos      !== undefined) payload.ganhos      = dados.ganhos;
      if (dados.despesasFixas !== undefined) payload.despesasFixas = dados.despesasFixas;
      if (dados.orcamentos  !== undefined) payload.orcamentos  = dados.orcamentos;
      var { data, error } = await db.from('responsaveis').update(payload).eq('id', id).select().single();
      if (error) throw error;
      var idx = responsaveis.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) Object.assign(responsaveis[idx], data);
      return data;
    },

    getById: function (id) {
      return responsaveis.find(function (r) { return r.id === id; }) || null;
    },

    removeResponsavel: async function (id) {
      var { error } = await db.from('responsaveis').delete().eq('id', id);
      if (error) throw error;
      var idx = responsaveis.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) responsaveis.splice(idx, 1);
    },

    // ── Categorias ──────────────────────────────────────────
    addCategoria: async function (c) {
      var payload = { nome: c.nome, tipo: c.tipo, cor: c.cor };
      var { data, error } = await db.from('categorias').insert(payload).select().single();
      if (error) throw error;
      categorias.push(data);
      return data;
    },

    updateCategoria: async function (id, dados) {
      var { data, error } = await db.from('categorias').update(dados).eq('id', id).select().single();
      if (error) throw error;
      var idx = categorias.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) Object.assign(categorias[idx], data);
      return data;
    },

    removeCategoria: async function (id) {
      var { error } = await db.from('categorias').delete().eq('id', id);
      if (error) throw error;
      var idx = categorias.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) categorias.splice(idx, 1);
    },

    // ── Caixinhas ───────────────────────────────────────────
    // lancamentos da caixinha ficam em coluna JSONB
    addCaixinha: async function (c) {
      var payload = Object.assign({}, c, { lancamentos: [] });
      delete payload.id;
      var { data, error } = await db.from('caixinhas').insert(payload).select().single();
      if (error) throw error;
      caixinhas.push(data);
      return data;
    },

    updateCaixinha: async function (id, dados) {
      var { data, error } = await db.from('caixinhas').update(dados).eq('id', id).select().single();
      if (error) throw error;
      var idx = caixinhas.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) Object.assign(caixinhas[idx], data);
      return data;
    },

    removeCaixinha: async function (id) {
      var { error } = await db.from('caixinhas').delete().eq('id', id);
      if (error) throw error;
      var idx = caixinhas.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) caixinhas.splice(idx, 1);
    },

    addLancCaixinha: async function (caixinhaId, l) {
      var c = caixinhas.find(function (x) { return x.id === caixinhaId; });
      if (!c) return null;
      l.id = Date.now();
      var lista = (c.lancamentos || []).concat([l]);
      var { data, error } = await db.from('caixinhas').update({ lancamentos: lista }).eq('id', caixinhaId).select().single();
      if (error) throw error;
      var idx = caixinhas.findIndex(function (x) { return x.id === caixinhaId; });
      if (idx !== -1) caixinhas[idx] = data;
      return l;
    },

    removeLancCaixinha: async function (caixinhaId, lancId) {
      var c = caixinhas.find(function (x) { return x.id === caixinhaId; });
      if (!c) return;
      var lista = (c.lancamentos || []).filter(function (l) { return l.id !== lancId; });
      var { error } = await db.from('caixinhas').update({ lancamentos: lista }).eq('id', caixinhaId);
      if (error) throw error;
      c.lancamentos = lista;
    },

    // ── Despesas manuais (Supabase) ──────────────────────────
    addDespesaManual: async function (d) {
      var payload = {
        mes_idx:   d.mesIdx,
        resp_id:   d.respId,
        quinzena:  d.quinzena,
        descricao: d.desc,
        valor:     d.valor,
      };
      var { data, error } = await db.from('despesas_manuais').insert(payload).select().single();
      if (error) throw error;
      var row = { id: data.id, mesIdx: parseInt(data.mes_idx), respId: parseInt(data.resp_id), quinzena: parseInt(data.quinzena), desc: data.descricao, valor: parseFloat(data.valor) };
      despesasManuais.push(row);
      return row;
    },

    getDespesasManuais: function (mesIdx, respId) {
      return despesasManuais.filter(function (d) {
        return parseInt(d.mesIdx) === parseInt(mesIdx) && parseInt(d.respId) === parseInt(respId);
      });
    },

    updateDespesaManual: async function (id, dados) {
      var payload = {};
      if (dados.desc  !== undefined) payload.descricao = dados.desc;
      if (dados.valor !== undefined) payload.valor = dados.valor;
      var { error } = await db.from('despesas_manuais').update(payload).eq('id', id);
      if (error) throw error;
      var d = despesasManuais.find(function (x) { return x.id === id; });
      if (d) Object.assign(d, dados);
      return d;
    },

    removeDespesaManual: async function (id) {
      var { error } = await db.from('despesas_manuais').delete().eq('id', id);
      if (error) throw error;
      var idx = despesasManuais.findIndex(function (d) { return d.id === id; });
      if (idx !== -1) despesasManuais.splice(idx, 1);
    },

    // ── Metas de orçamento (in-memory) ──────────────────────
    getMetas: function () { return metas; },

    addMeta: function (m) {
      m.id = Date.now();
      metas.push(m);
      return m;
    },

    updateMeta: function (id, dados) {
      var m = metas.find(function (x) { return x.id === id; });
      if (m) Object.assign(m, dados);
      return m;
    },

    removeMeta: function (id) {
      var idx = metas.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) metas.splice(idx, 1);
    },

    // ── Importações ─────────────────────────────────────────
    getImportacoes: function () { return importacoes; },

    addImportacao: async function (b) {
      var payload = {
        tipo:         b.tipo,
        destino_nome: b.destinoNome,
        cx_id:        b.cxId || null,
        total:        b.total,
        ids:          b.ids || [],
      };
      var { data, error } = await db.from('importacoes').insert(payload).select().single();
      if (error) throw error;
      importacoes.unshift(data);
      return data;
    },

    removeImportacao: async function (id) {
      var { error } = await db.from('importacoes').delete().eq('id', id);
      if (error) throw error;
      var idx = importacoes.findIndex(function (x) { return x.id === id; });
      if (idx !== -1) importacoes.splice(idx, 1);
    },

    // ── Resetar dados ────────────────────────────────────────
    resetarDados: async function () {
      await Promise.all([
        db.from('lancamentos').delete().gt('id', 0),
        db.from('caixinhas').delete().gt('id', 0),
      ]);
      location.reload();
    },
  };

  return api;
})();
