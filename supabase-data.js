(function () {
  const knownReservationIds = new Set();
  const knownDocumentIds = new Set();

function isSupabaseConfigured() {
  return Boolean(
    window.RENTCAR_SUPABASE_URL &&
      String(window.RENTCAR_SUPABASE_URL).includes("supabase.co") &&
      window.RENTCAR_SUPABASE_ANON_KEY &&
      String(window.RENTCAR_SUPABASE_ANON_KEY).length > 20 &&
      window.supabase &&
      typeof window.supabase.createClient === "function"
  );
}

  function getSupabaseClient() {
    if (!isSupabaseConfigured()) return null;
    if (!window.__rentcarSupabase) {
      window.__rentcarSupabase = window.supabase.createClient(
        window.RENTCAR_SUPABASE_URL,
        window.RENTCAR_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }
    return window.__rentcarSupabase;
  }

  function rowToReservation(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      customerName: row.customer_name || "",
      phone: row.phone || "",
      email: row.email || "",
      carType: row.car_type,
      startAt: row.start_at,
      endAt: row.end_at,
      startTimeSelection: row.start_time_selection || "",
      endTimeSelection: row.end_time_selection || "",
      startOutsideHours: Boolean(row.start_outside_hours),
      endOutsideHours: Boolean(row.end_outside_hours),
      estimatedTotal: Number(row.estimated_total) || 0,
      estimatedBaseTotal: Number(row.estimated_base_total) || 0,
      estimatedOptionTotal: Number(row.estimated_option_total) || 0,
      options: row.options && typeof row.options === "object" ? row.options : {},
      paymentMethod: row.payment_method || "",
      paymentPaid: Boolean(row.payment_paid),
      notes: row.notes || "",
      status: row.status || "受付",
      isRead: Boolean(row.is_read)
    };
  }

  function reservationToRow(item) {
    return {
      id: item.id,
      created_at: item.createdAt || new Date().toISOString(),
      customer_name: item.customerName || "",
      phone: item.phone || "",
      email: item.email || "",
      car_type: item.carType,
      start_at: item.startAt,
      end_at: item.endAt,
      start_time_selection: item.startTimeSelection || "",
      end_time_selection: item.endTimeSelection || "",
      start_outside_hours: Boolean(item.startOutsideHours),
      end_outside_hours: Boolean(item.endOutsideHours),
      estimated_total: Number(item.estimatedTotal) || 0,
      estimated_base_total: Number(item.estimatedBaseTotal) || 0,
      estimated_option_total: Number(item.estimatedOptionTotal) || 0,
      options: item.options || {},
      payment_method: item.paymentMethod || "",
      payment_paid: Boolean(item.paymentPaid),
      notes: item.notes || "",
      status: item.status || "受付",
      is_read: Boolean(item.isRead)
    };
  }

  function rowToDocument(row) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    return {
      ...payload,
      id: row.id,
      reservationId: row.reservation_id || payload.reservationId || "",
      type: row.type || payload.type,
      documentNumber: row.document_number || payload.documentNumber || "",
      issuedAt: row.issued_at || payload.issuedAt
    };
  }

  function documentToRow(doc, validReservationIds) {
    const reservationId = doc.reservationId || null;
    const safeReservationId =
      reservationId && (!validReservationIds || validReservationIds.has(reservationId))
        ? reservationId
        : null;
    return {
      id: doc.id,
      reservation_id: safeReservationId,
      type: doc.type,
      document_number: doc.documentNumber || "",
      issued_at: doc.issuedAt || new Date().toISOString(),
      payload: doc
    };
  }

  function buildDefaultRemoteData() {
    return {
      fleet: JSON.parse(JSON.stringify(DEFAULT_DATA.fleet)),
      catalog: JSON.parse(JSON.stringify(DEFAULT_CATALOG)),
      carOrder: [...DEFAULT_CAR_TYPES],
      site: { ...DEFAULT_SITE },
      rates: JSON.parse(JSON.stringify(DEFAULT_RATES)),
      reservations: [],
      documents: []
    };
  }

  async function ensureSettingsSeed(client, defaults) {
    // 公開ページ（anon）は INSERT できないため、無いときだけ管理者ログイン時にシードする。
    const { data: existing, error: readError } = await client
      .from("app_settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) return;

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return;

    const { error } = await client.from("app_settings").upsert({
      id: 1,
      fleet: defaults.fleet,
      catalog: defaults.catalog,
      site: defaults.site,
      rates: defaults.rates,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function fetchRentcarData() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase が設定されていません。");
    }

    const defaults = buildDefaultRemoteData();
    await ensureSettingsSeed(client, defaults);

    const { data: settings, error: settingsError } = await client
      .from("app_settings")
      .select("fleet, catalog, site, rates")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const {
      data: { session }
    } = await client.auth.getSession();

    let reservations = [];
    let documents = [];

    if (session) {
      const { data: reservationRows, error: reservationError } = await client
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false });
      if (reservationError) throw reservationError;
      reservations = (reservationRows || []).map(rowToReservation);

      const { data: documentRows, error: documentError } = await client
        .from("documents")
        .select("*")
        .order("issued_at", { ascending: false });
      if (documentError) throw documentError;
      documents = (documentRows || []).map(rowToDocument);
    } else {
      const { data: scheduleRows, error: scheduleError } = await client.rpc(
        "get_reservation_schedule"
      );
      if (scheduleError) throw scheduleError;
      reservations = (scheduleRows || []).map((row) => ({
        id: row.id,
        carType: row.car_type,
        startAt: row.start_at,
        endAt: row.end_at,
        status: row.status,
        customerName: "",
        phone: "",
        email: "",
        options: {},
        paymentMethod: "",
        paymentPaid: false,
        notes: "",
        isRead: true,
        estimatedTotal: 0,
        estimatedBaseTotal: 0,
        estimatedOptionTotal: 0,
        startTimeSelection: "",
        endTimeSelection: "",
        startOutsideHours: false,
        endOutsideHours: false,
        createdAt: row.start_at
      }));
    }

    knownReservationIds.clear();
    reservations.forEach((item) => knownReservationIds.add(item.id));
    knownDocumentIds.clear();
    documents.forEach((item) => knownDocumentIds.add(item.id));

    const catalog = mergeCatalog(settings?.catalog);
    const fleet = mergeFleet(settings?.fleet);
    const site = mergeSite(settings?.site);
    return {
      fleet,
      catalog,
      carOrder: mergeCarOrder(site.carOrder, catalog, fleet),
      site,
      rates: mergeRates(settings?.rates),
      reservations,
      documents
    };
  }

  async function upsertSettings(client, data) {
    const carOrder = mergeCarOrder(data.carOrder, data.catalog, data.fleet);
    const { error } = await client
      .from("app_settings")
      .upsert({
        id: 1,
        fleet: data.fleet,
        catalog: data.catalog,
        site: { ...data.site, carOrder },
        rates: data.rates,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  async function fullSyncRows(client, table, rows, toRow) {
    const { data: existing, error: existingError } = await client.from(table).select("id");
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map((row) => row.id));
    const nextIds = new Set(rows.map((item) => item.id));

    const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
    if (toDelete.length) {
      const { error } = await client.from(table).delete().in("id", toDelete);
      if (error) throw error;
    }

    if (rows.length) {
      const { error } = await client.from(table).upsert(rows.map(toRow));
      if (error) throw error;
    }
  }

  async function persistRentcarData(data, options = {}) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase が設定されていません。");
    }

    const {
      data: { session }
    } = await client.auth.getSession();

    if (session) {
      await upsertSettings(client, data);
      // 店舗設定・料金・メール文面などは app_settings のみ更新すれば足りる
      if (options.settingsOnly) {
        return;
      }

      const reservationIds = new Set((data.reservations || []).map((item) => item.id));
      await fullSyncRows(client, "reservations", data.reservations || [], reservationToRow);
      await fullSyncRows(client, "documents", data.documents || [], (doc) =>
        documentToRow(doc, reservationIds)
      );
      knownReservationIds.clear();
      (data.reservations || []).forEach((item) => knownReservationIds.add(item.id));
      knownDocumentIds.clear();
      (data.documents || []).forEach((item) => knownDocumentIds.add(item.id));
      return;
    }

    const newReservations = data.reservations.filter((item) => !knownReservationIds.has(item.id));
    for (const item of newReservations) {
      if (!item.customerName && !item.email && !item.phone) continue;
      const available = await assertCarAvailabilityRemote(item.carType, item.startAt, item.endAt);
      if (!available) {
        throw new Error(
          `${item.carType} は指定期間に予約できません（貸出開始1時間前〜返却1時間後は不可）。別の時間を選んでください。`
        );
      }
      const { error } = await client.from("reservations").insert(reservationToRow(item));
      if (error) throw error;
      knownReservationIds.add(item.id);
    }

    const reservationIds = new Set([
      ...knownReservationIds,
      ...(data.reservations || []).map((item) => item.id)
    ]);
    const newDocuments = data.documents.filter((item) => !knownDocumentIds.has(item.id));
    for (const item of newDocuments) {
      const { error } = await client.from("documents").insert(documentToRow(item, reservationIds));
      if (error) throw error;
      knownDocumentIds.add(item.id);
    }
  }

  async function loginAdminWithSupabase(email, password) {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase が設定されていません。" };
    const { error } = await client.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (error) return { ok: false, error: error.message || "ログインに失敗しました。" };
    return { ok: true };
  }

  async function logoutAdminFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
  }

  async function isSupabaseAdminLoggedIn() {
    const client = getSupabaseClient();
    if (!client) return false;
    const {
      data: { session }
    } = await client.auth.getSession();
    return Boolean(session);
  }

  async function sendReservationEmailViaSupabase(reservation, estimateDocument, extras = {}) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase が設定されていません。");
    }
    const { data, error } = await client.functions.invoke("send-confirmation", {
      body: { reservation, estimateDocument, ...extras }
    });
    if (error) {
      throw new Error(error.message || "メール送信に失敗しました。");
    }
    if (data && data.ok === false) {
      throw new Error(data.error || "メール送信に失敗しました。");
    }
    return data;
  }

  async function assertCarAvailabilityRemote(carType, startAt, endAt, bufferHours = 1) {
    const fallback = () =>
      isCarTypeAvailable(loadData(), carType, startAt, endAt, { bufferHours });

    const client = getSupabaseClient();
    if (!client) return fallback();

    const { data, error } = await client.rpc("is_car_available", {
      p_car_type: carType,
      p_start_at: startAt,
      p_end_at: endAt,
      p_buffer_hours: bufferHours
    });
    if (error) {
      console.warn("is_car_available RPC:", error.message || error);
      return fallback();
    }
    return Boolean(data);
  }

  async function filterAvailableCarTypesRemote(types, startAt, endAt, bufferHours = 1) {
    const list = Array.isArray(types) ? types : [];
    const available = [];
    for (const type of list) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await assertCarAvailabilityRemote(type, startAt, endAt, bufferHours);
      if (ok) available.push(type);
    }
    return available;
  }

  window.isSupabaseConfigured = isSupabaseConfigured;
  window.getSupabaseClient = getSupabaseClient;
  window.fetchRentcarData = fetchRentcarData;
  window.persistRentcarData = persistRentcarData;
  window.loginAdminWithSupabase = loginAdminWithSupabase;
  window.logoutAdminFromSupabase = logoutAdminFromSupabase;
  window.isSupabaseAdminLoggedIn = isSupabaseAdminLoggedIn;
  window.sendReservationEmailViaSupabase = sendReservationEmailViaSupabase;
  window.assertCarAvailabilityRemote = assertCarAvailabilityRemote;
  window.filterAvailableCarTypesRemote = filterAvailableCarTypesRemote;
})();
