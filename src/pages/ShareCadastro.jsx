import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, API_URL } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle2, AlertCircle, User, Phone, MapPin, House, Clock, FileText, Home } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fetchCircuitoMap } from "@/lib/congregations";
import { useTranslation } from "@/lib/i18n";

const STATUS_COLORS = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-700",
  "Mudou-se": "bg-yellow-100 text-yellow-700",
  "Não Interessado": "bg-red-100 text-red-700",
};

const API_BASE = `${API_URL}/public/enderecos`;

const FIELD_ALIASES = {
  name: ["name", "nome", "nome_completo"],
  gender: ["gender", "genero", "sexo"],
  age: ["age", "idade"],
  street: ["street", "endereco", "rua", "address"],
  neighborhood: ["neighborhood", "bairro"],
  city: ["city", "cidade"],
  state: ["state", "estado", "provincia"],
  lat: ["lat", "latitude"],
  lng: ["lng", "longitude", "lon", "long"],
  phone: ["phone", "telefone", "celular", "whatsapp"],
  observations: ["observations", "observacoes", "obs", "nota", "notas"],
  reference_point: ["reference_point", "ponto_referencia", "referencia"],
  best_time: ["best_time", "melhor_horario", "horario"],
  sign_language_level: ["sign_language_level", "nivel_lsm", "nivel_libras"],
  status: ["status"],
  congregation: ["congregation", "congregacao"],
  congregation_id: ["congregation_id", "congregacao_id"],
  last_visit_date: ["last_visit_date", "data_ultima_visita", "ultima_visita"],
  last_visit_time: ["last_visit_time", "hora_ultima_visita"],
  last_visited_by: ["last_visited_by", "visitado_por"],
  visit_count: ["visit_count", "total_visitas", "numero_visitas"],
};

function mapApiData(data) {
  const mapped = {};
  for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const val = data[alias];
      if (val !== undefined && val !== null && val !== "") {
        mapped[target] = val;
        break;
      }
    }
  }
  if (!mapped.congregation) mapped.congregation = "Não definida";
  if (!mapped.gender) mapped.gender = "Masculino";
  if (!mapped.status) mapped.status = "Ativo";
  if (mapped.visit_count === undefined) mapped.visit_count = 0;
  return mapped;
}

export default function ShareCadastro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [existingAddr, setExistingAddr] = useState(null);
  const [imported, setImported] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetch(`${API_BASE}/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error("Erro ao buscar cadastro");
        return res.json();
      })
      .then((data) => {
        if (data) setAddress(mapApiData(data));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleImport = async () => {
    setImporting(true);
    try {
      let existing = [];
      // Check by phone first
      if (address.phone) {
        existing = await api.entities.Address.filter({ phone: address.phone });
      }
      // If not found by phone, check by name + street + city
      if ((!existing || existing.length === 0) && address.name && address.street) {
        const query = { name: address.name, street: address.street };
        if (address.city) query.city = address.city;
        existing = await api.entities.Address.filter(query);
      }
      setImporting(false);

      if (existing && existing.length > 0) {
        setExistingAddr(existing[0]);
        setShowConfirm(true);
      } else {
        await createNew();
      }
    } catch (e) {
      setImporting(false);
      toast.error(t("share.import_error"));
    }
  };

  const createNew = async () => {
    setImporting(true);
    const { id: _id, created_date, updated_date, created_by_id, ...data } = address;
    const circMap = await fetchCircuitoMap();
    data.circuito_id = circMap[data.congregation] || "";
    await api.entities.Address.create(data);
    setImporting(false);
    setImported(true);
    toast.success(t("share.import_success"));
    };

    const updateExisting = async () => {
    setShowConfirm(false);
    setImporting(true);
    const { id: _id, created_date, updated_date, created_by_id, ...data } = address;
    const circMap = await fetchCircuitoMap();
    data.circuito_id = circMap[data.congregation] || "";
    await api.entities.Address.update(existingAddr.id, data);
    setImporting(false);
    setImported(true);
    toast.success(t("share.update_success"));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-sm w-full p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-heading font-bold text-xl">{t("share.not_found_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("share.not_found_desc")}</p>
          <Button className="w-full rounded-xl gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
            {t("share.back_btn")}
          </Button>
        </Card>
      </div>
    );
  }

  if (imported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-sm w-full p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="font-heading font-bold text-xl">{t("share.success_title")}</h1>
          <p className="text-muted-foreground text-sm">{t("share.success_desc", { name: address.name })}</p>
          <Button className="w-full rounded-xl gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
            {t("share.back_btn")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="font-heading font-bold text-2xl">{t("share.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("share.subtitle")}</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading font-bold text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary shrink-0" />
              {address.name}
            </h2>
            {address.status && (
              <Badge className={STATUS_COLORS[address.status] || "bg-muted text-muted-foreground"}>
                {address.status}
              </Badge>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {address.phone && <InfoRow icon={Phone} label={t("common.phone")} value={address.phone} />}
            {address.city && <InfoRow icon={MapPin} label={t("common.city")} value={address.city} />}
            {address.neighborhood && <InfoRow icon={MapPin} label={t("common.neighborhood")} value={address.neighborhood} />}
            {address.congregation && <InfoRow icon={House} label={t("common.congregation")} value={address.congregation} />}
            {address.best_time && <InfoRow icon={Clock} label={t("common.best_time")} value={address.best_time} />}
            {address.observations && <InfoRow icon={FileText} label={t("common.observations")} value={address.observations} />}
          </div>
        </Card>

        <Button className="w-full rounded-xl gap-2" size="lg" onClick={handleImport} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {importing ? t("share.importing") : t("share.import_btn")}
        </Button>

        <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => navigate("/")}>
          <Home className="h-4 w-4" />
          {t("share.back_btn")}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("share.exists_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("share.exists_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={updateExisting}>{t("share.update_btn")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
