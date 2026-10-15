import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, LocateFixed, WifiOff, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { getCurrentPosition, reverseGeocode, extractCoords } from "@/lib/maps";
import { useCongregations, useCongregationObjects } from "@/lib/congregations";
import { savePending, savePendingUpdate, getCachedAddresses } from "@/lib/offlineDb";
import ImportAddressButton from "@/components/ImportAddressButton";
import { fetchAddressForUser, fetchAddressesForUser, hasPermission, normalizeRole, setCongregationCircuitCache, isAdminCircuitIsolated } from "@/lib/permissions";
import { goBack } from "@/lib/goBack";
import { useSaveAddressMutation } from "@/hooks/useAddressesQuery";
import { findDuplicates } from "@/lib/duplicateDetect";
import DuplicateAlertDialog from "@/components/duplicates/DuplicateAlertDialog";
import { useTranslation } from "@/lib/i18n";

export default function AddressForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("edit");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!editId);
  const [user, setUser] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectedVisit, setDetectedVisit] = useState(false);
  const [dupAlert, setDupAlert] = useState({ open: false, matches: [], candidate: null, data: null, visitInfo: null, mode: null });
  const { congregations, loading: loadingCongregations } = useCongregations();
  const { items: congObjects, loading: loadingCongregationObjects } = useCongregationObjects();
  const canMerge = ["elder", "superintendente", "admin"].includes(normalizeRole(user?.role));
  const { t } = useTranslation();

  const [form, setForm] = useState({
    congregation: "",
    name: "",
    gender: "",
    age: "",
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    coordinates: "",
    phone: "",
    observations: "",
    reference_point: "",
    house_photo: "",
    best_time: "",
    sign_language_level: "",
    language: "",
    language_level: "",
    situacao: "",
    status: "Ativo",
    last_visit_date: "",
    last_visit_time: "",
    last_visited_by: "",
    visit_count: 0,
  });

  useEffect(() => {
    // Offline-first: usa usuário em cache (ls_offline_user_cache) quando sem
    // conexão, para preencher a congregação sem depender do servidor.
    const getUser = async () => {
      if (!navigator.onLine) {
        try {
          const cached = JSON.parse(localStorage.getItem("ls_offline_user_cache") || "null");
          if (cached) return cached;
          toast.error(t("form.cong_offline_no_user"));
        } catch {}
      }
      return await api.auth.me();
    };

    getUser().then(u => {
      setUser(u);
      if (!editId && u?.congregation) {
        setForm(p => ({ ...p, congregation: u.congregation || "" }));
      } else if (!editId && !u?.congregation && !navigator.onLine) {
        toast.error(t("form.cong_offline_not_found"));
      }

      // Pre-fill from quick register (GPS) — read from sessionStorage
      const stored = sessionStorage.getItem("address_prefill");
      if (stored) {
        try {
          const prefill = JSON.parse(stored);
          setForm(p => ({ ...p, ...prefill }));
        } catch {}
        sessionStorage.removeItem("address_prefill");
      }

      if (editId) {
        fetchAddressForUser(u, editId).then(addr => {
          if (!addr) {
            toast.error(t("form.no_edit_permission"));
            navigate("/addresses");
            return;
          }
          setForm({
            congregation: addr.congregation || "",
            name: addr.name || "",
            gender: addr.gender || "",
            age: addr.age || "",
            street: addr.street || "",
            neighborhood: addr.neighborhood || "",
            city: addr.city || "",
            state: addr.state || "",
            coordinates: (addr.lat && addr.lng) ? `${addr.lat}, ${addr.lng}` : "",
            phone: addr.phone || "",
            observations: addr.observations || "",
            reference_point: addr.reference_point || "",
            house_photo: addr.house_photo || "",
            best_time: addr.best_time || "",
            sign_language_level: addr.sign_language_level || "",
            language: addr.language || "",
            language_level: addr.language_level || "",
            situacao: addr.situacao || "",
            status: addr.status || "Ativo",
            last_visit_date: addr.last_visit_date || "",
            last_visit_time: addr.last_visit_time || "",
            last_visited_by: addr.last_visited_by || "",
            visit_count: addr.visit_count || 0,
          });
          setLoadingData(false);
        }).catch(() => setLoadingData(false));
      } else {
        setLoadingData(false);
      }
    }).catch(() => setLoadingData(false));
  }, [editId]);

  const updateField = (field, value) => setForm(p => ({ ...p, [field]: value }));

  useEffect(() => { setCongregationCircuitCache(congObjects); }, [congObjects]);

  const role = normalizeRole(user?.role);
  const saveAddress = useSaveAddressMutation(user?.id);
  const congregationOptions = useMemo(() => {
    const userCircuitId = String(user?.circuito_id || user?.circuitoId || "");
    const namesFromObjects = (congObjects || [])
      .filter((congregation) => {
        if (role === "admin" && !isAdminCircuitIsolated(user)) return true;
        if (["admin", "superintendente"].includes(role) && userCircuitId) {
          const congregationCircuitId = congregation?.circuito_id || congregation?.circuitoId;
          return String(congregationCircuitId || "") === userCircuitId;
        }
        return false;
      })
      .map((congregation) => congregation?.name || congregation?.nome);

    let names;
    if (role === "admin" && !isAdminCircuitIsolated(user)) {
      names = namesFromObjects.length > 0 ? namesFromObjects : congregations;
    } else if (["admin", "superintendente"].includes(role) && userCircuitId) {
      names = namesFromObjects;
    } else {
      names = user?.congregation ? [user.congregation] : [];
    }

    // Mantém a congregação atual ao editar registros antigos e evita opções
    // vazias ou duplicadas retornadas pela API/cache.
    if (form.congregation) names = [...(names || []), form.congregation];
    return [...new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [congObjects, congregations, form.congregation, role, user]);

  const congregationOptionsLoading = loadingCongregations || loadingCongregationObjects;

  // Após salvar, envia o usuário para a primeira página que ele pode acessar,
  // evitando a tela de "Acesso Restrito" em /addresses para quem não tem a permissão.
  const goAfterSave = (addressId) => {
    if (editId && addressId && hasPermission(user, "page_addresses")) return `/addresses/${addressId}`;
    if (hasPermission(user, "page_addresses")) return "/addresses";
    if (hasPermission(user, "page_my_territories")) return "/my-territories";
    return "/";
  };
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      updateField("house_photo", file_url);
      toast.success(t("form.photo_added"));
    } catch {
      toast.error(t("form.photo_error"));
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  // Link do Google Maps gerado automaticamente a partir das coordenadas
  const parsedCoords = extractCoords(form.coordinates);
  const generatedMapsLink = parsedCoords
    ? `https://www.google.com/maps/search/?api=1&query=${parsedCoords.lat},${parsedCoords.lng}`
    : "";

  const handleImport = (data) => {
    // Se o JSON trouxe lat/lng, usa; se não, tenta extrair do maps_link
    let lat = data.lat;
    let lng = data.lng;
    if (!lat && !lng && data.maps_link) {
      const coords = extractCoords(data.maps_link);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    const coordinates = (lat && lng) ? `${lat}, ${lng}` : "";
    setForm(p => ({
      ...p,
      ...data,
      coordinates,
      status: data.status || p.status || "Ativo",
      visit_count: data.visit_count !== undefined ? Number(data.visit_count) : p.visit_count,
    }));
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      updateField("coordinates", `${lat}, ${lng}`);
      setDetectedVisit(true);
      // O GPS funciona offline; o reverse geocoding precisa de internet
      if (!navigator.onLine) {
        toast.success(t("form.coords_offline"));
        return;
      }
      toast.info(t("form.coords_searching"));
      try {
        const address = await reverseGeocode(lat, lng);
        if (address) {
          if (address.street) updateField("street", address.street);
          if (address.neighborhood) updateField("neighborhood", address.neighborhood);
          if (address.city) updateField("city", address.city);
          if (address.state) updateField("state", address.state);
          if (address.reference_point) updateField("reference_point", address.reference_point);
          toast.success(t("form.address_filled"));
        } else {
          toast.success(t("form.coords_filled"));
        }
      } catch {
        toast.success(t("form.coords_filled"));
      }
    } catch (e) {
      toast.error(e.message || t("form.location_error"));
    } finally {
      setDetecting(false);
    }
  };

  // Preenche automaticamente os campos de endereço quando o usuário digita
  // coordenadas e muda para outro campo (reverse geocoding via OpenStreetMap).
  const handleCoordinatesBlur = async () => {
    const coords = extractCoords(form.coordinates);
    if (!coords) return;
    if (!navigator.onLine) return; // offline: sem reverse geocoding
    setDetecting(true);
    try {
      const address = await reverseGeocode(coords.lat, coords.lng);
      if (address) {
        let filled = false;
        if (!form.street && address.street) { updateField("street", address.street); filled = true; }
        if (!form.neighborhood && address.neighborhood) { updateField("neighborhood", address.neighborhood); filled = true; }
        if (!form.city && address.city) { updateField("city", address.city); filled = true; }
        if (!form.state && address.state) { updateField("state", address.state); filled = true; }
        if (!form.reference_point && address.reference_point) { updateField("reference_point", address.reference_point); filled = true; }
        if (filled) toast.success(t("form.address_filled"));
      }
    } catch {} finally {
      setDetecting(false);
    }
  };

  const buildPayload = () => {
    const coords = extractCoords(form.coordinates);
    const maps_link = coords ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : null;
    const { coordinates, ...formData } = form;
    const circuito_id = congObjects.find(c => c.name === form.congregation)?.circuito_id || "";
    return {
      ...formData,
      circuito_id,
      maps_link,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      age: form.age ? Number(form.age) : null,
      visit_count: form.visit_count ? Number(form.visit_count) : 0,
    };
  };

  const handleSaveOffline = () => {
    if (!form.congregation) {
      toast.error(t("form.select_congregation"));
      return;
    }
    if (!form.name) {
      toast.error(t("form.enter_name"));
      return;
    }
    let data = buildPayload();
    if (detectedVisit) {
      const now = new Date();
      data = {
        ...data,
        last_visit_date: now.toISOString().split("T")[0],
        last_visit_time: now.toTimeString().slice(0, 5),
        last_visited_by: user?.full_name || "—",
        visit_count: (Number(form.visit_count) || 0) + 1,
      };
    }
    // Detecção de possíveis duplicados usando o cache local do dispositivo.
    if (!editId) {
      const cached = getCachedAddresses();
      const matches = findDuplicates(data, cached);
      if (matches.length > 0) {
        setDupAlert({ open: true, matches, candidate: data, data, visitInfo: null, mode: "offline" });
        return;
      }
    }
    savePending(data);
    toast.success(t("form.saved_offline"));
    navigate(goAfterSave(null));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.congregation) {
      toast.error(t("form.select_congregation"));
      return;
    }

    let data = buildPayload();
    let visitInfo = null;

    if (detectedVisit) {
      const now = new Date();
      visitInfo = {
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
        by: user?.full_name || "—",
      };
      data = {
        ...data,
        last_visit_date: visitInfo.date,
        last_visit_time: visitInfo.time,
        last_visited_by: visitInfo.by,
        visit_count: (Number(form.visit_count) || 0) + 1,
      };
    }

    // Offline: salva na fila local e sincroniza quando houver conexão
    if (!navigator.onLine) {
      if (editId) {
        savePendingUpdate(editId, data);
        toast.success(t("form.saved_update_offline"));
        goBack(navigate, "/addresses");
      } else {
        handleSaveOffline();
      }
      return;
    }

    // Detecção de duplicados antes de salvar (somente novo cadastro, online)
    if (!editId && user) {
      const existing = await fetchAddressesForUser(user).catch(() => []);
      const matches = findDuplicates(data, existing);
      if (matches.length > 0) {
        setDupAlert({ open: true, matches, candidate: data, data, visitInfo });
        return;
      }
    }

    await runSave(data, visitInfo);
  };

  const runSave = async (saveData, saveVisitInfo) => {
    setLoading(true);
    try {
      const { addressId } = await saveAddress.mutateAsync({ editId, data: saveData, visitInfo: saveVisitInfo, form });
      toast.success(editId ? t("form.updated") : t("form.created"), {
        description: editId
          ? t("form.updated_description")
          : t("form.created_description"),
      });
      navigate(goAfterSave(addressId));
    } catch (err) {
      toast.error(editId ? "Não foi possível salvar as alterações" : "Não foi possível salvar o endereço", {
        description: err?.message || t("form.save_fail_description"),
      });
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <DuplicateAlertDialog
        open={dupAlert.open}
        candidate={dupAlert.candidate}
        duplicates={dupAlert.matches}
        offline={dupAlert.mode === "offline"}
        onOpenChange={(v) => { if (!v) setDupAlert((s) => ({ ...s, open: false })); }}
        onSaveAnyway={() => {
          const { data: d, visitInfo: vi, mode } = dupAlert;
          setDupAlert({ open: false, matches: [], candidate: null, data: null, visitInfo: null, mode: null });
          if (mode === "offline") {
            savePending(d);
            toast.success(t("form.saved_offline"));
            navigate(goAfterSave(null));
          } else {
            runSave(d, vi);
          }
        }}
        onOpenExisting={canMerge ? (ex) => navigate(`/addresses/${ex.id}`) : undefined}
      />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => goBack(navigate, "/addresses")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-2xl">{editId ? t("form.title_edit") : t("form.title_new")} {t("form.title_suffix")}</h1>
          {!editId && <ImportAddressButton onImport={handleImport} />}
        </div>
        <p className="text-muted-foreground text-sm">{t("form.subtitle")}</p>
        </div>
        </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-6">
        {/* Basic info */}
        <div className="space-y-4">
          <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t("form.section_personal")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>{t("form.name")}</Label>
              <Input required placeholder={t("form.name_ph")} value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.gender")}</Label>
              <Select required value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                <SelectTrigger><SelectValue placeholder={t("form.select")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">👨 {t("gender.masculino")}</SelectItem>
                  <SelectItem value="Feminino">👩 {t("gender.feminino")}</SelectItem>
                  <SelectItem value="Casal">👫 {t("gender.casal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("form.age")}</Label>
              <Input type="number" placeholder={t("form.age_ph")} value={form.age} onChange={(e) => updateField("age", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.phone")}</Label>
              <Input placeholder={t("form.phone_ph")} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("form.language_level")}</Label>
              <Select value={form.language_level} onValueChange={(v) => updateField("language_level", v)}>
                <SelectTrigger><SelectValue placeholder={t("form.select")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">{t("language_level.basico")}</SelectItem>
                  <SelectItem value="Intermediário">{t("language_level.intermediario")}</SelectItem>
                  <SelectItem value="Avançado">{t("language_level.avancado")}</SelectItem>
                  <SelectItem value="Fluente">{t("language_level.fluente")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("form.language_level_help")}</p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t("form.section_address")}</h2>
          <Button type="button" variant="outline" className="w-full gap-2 rounded-xl" onClick={handleDetectLocation} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {detecting ? t("form.detecting") : t("form.detect_coords")}
          </Button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>{t("form.street")}</Label>
              <Input placeholder={t("form.street_ph")} value={form.street} onChange={(e) => updateField("street", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.neighborhood")}</Label>
              <Input placeholder={t("form.neighborhood_ph")} value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.city")}</Label>
              <Input placeholder={t("form.city_ph")} value={form.city} onChange={(e) => updateField("city", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.state")}</Label>
              <Input placeholder={t("form.state_ph")} value={form.state} onChange={(e) => updateField("state", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("form.coordinates")}</Label>
              <Input
                placeholder={t("form.coordinates_ph")}
                value={form.coordinates}
                onChange={(e) => updateField("coordinates", e.target.value)}
                onBlur={handleCoordinatesBlur}
              />
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">{t("form.maps_link_label")}</Label>
                <Input
                  readOnly
                  placeholder={t("form.maps_link_ph")}
                  value={generatedMapsLink}
                  className="bg-muted text-xs cursor-not-allowed"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("form.reference")}</Label>
              <Input placeholder={t("form.reference_ph")} value={form.reference_point} onChange={(e) => updateField("reference_point", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("form.photo")}</Label>
              <div className="flex items-center gap-4">
                {form.house_photo ? (
                  <div className="relative">
                    <img src={form.house_photo} alt={t("form.photo_alt")} className="h-24 w-24 object-cover rounded-xl border border-border" />
                    <button
                      type="button"
                      onClick={() => updateField("house_photo", "")}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs shadow"
                      title={t("form.photo_remove")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
                    <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                      {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {photoUploading ? t("form.photo_sending") : t("form.photo_capture")}
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Extra */}
        <div className="space-y-4">
          <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t("form.section_extra")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("form.congregation")}</Label>
              <Select
                required
                value={form.congregation}
                onValueChange={(v) => updateField("congregation", v)}
              >
                <SelectTrigger><SelectValue placeholder={t("form.congregation_ph")} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {congregationOptionsLoading ? (
                    <SelectItem value="__loading" disabled>{t("transfer.loading")}</SelectItem>
                  ) : congregationOptions.length === 0 ? (
                    <SelectItem value="__empty" disabled>{t("transfer.none")}</SelectItem>
                  ) : congregationOptions.map((congregation) => (
                    <SelectItem key={congregation} value={congregation}>{congregation}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("form.best_time")}</Label>
              <Input placeholder={t("form.best_time_ph")} value={form.best_time} onChange={(e) => updateField("best_time", e.target.value)} />
            </div>
            <div>
              <Label>{t("form.status")}</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">{t("status.ativo")}</SelectItem>
                  <SelectItem value="Inativo">{t("status.inativo")}</SelectItem>
                  <SelectItem value="Mudou-se">{t("status.mudou_se")}</SelectItem>
                  <SelectItem value="Não Interessado">{t("status.nao_interessado")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("form.situacao")}</Label>
              <Select value={form.situacao} onValueChange={(v) => updateField("situacao", v)}>
                <SelectTrigger><SelectValue placeholder={t("form.select")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interessado">{t("situacao.interessado")}</SelectItem>
                  <SelectItem value="Estudante">{t("situacao.estudante")}</SelectItem>
                  <SelectItem value="Publicador">{t("situacao.publicador")}</SelectItem>
                  <SelectItem value="Batizado">{t("situacao.batizado")}</SelectItem>
                  <SelectItem value="Pioneiro">{t("situacao.pioneiro")}</SelectItem>
                  <SelectItem value="Servo Ministerial">{t("situacao.servo_ministerial")}</SelectItem>
                  <SelectItem value="Ancião">{t("situacao.anciao")}</SelectItem>
                  <SelectItem value="Pioneiro Especial">{t("situacao.pioneiro_especial")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("form.observations")}</Label>
            <Textarea placeholder={t("form.observations_ph")} value={form.observations} onChange={(e) => updateField("observations", e.target.value)} rows={3} />
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button type="button" variant="outline" className="rounded-xl sm:flex-initial" onClick={() => goBack(navigate, "/addresses")}>
            {t("form.cancel")}
          </Button>
          {!editId && (
            <Button type="button" variant="secondary" className="rounded-xl gap-2 flex-1" onClick={handleSaveOffline}>
              <WifiOff className="h-4 w-4" />
              {t("form.save_offline")}
            </Button>
          )}
          <Button type="submit" className="rounded-xl gap-2 flex-1 sm:flex-initial" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            {editId ? t("form.save_changes") : t("form.register")}
          </Button>
        </div>
      </form>
    </div>
  );
}
